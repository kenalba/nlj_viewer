"""
Claude API service for Content Studio.
Handles file uploads to Claude Files API and content generation via Messages API.
"""

import asyncio
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import aiofiles
import anthropic

try:
    from anthropic.types.beta.file_object import FileObject
    from anthropic.types.message import Message
except ImportError:
    # Fallback for different Anthropic SDK versions
    FileObject = dict
    Message = dict

from app.core.config import settings


class ClaudeService:
    """
    Service for interacting with Claude Files API and Messages API.
    Handles document uploads, content generation, and response processing.
    """

    def __init__(self):
        if not settings.CLAUDE_API_KEY:
            print("Warning: CLAUDE_API_KEY not set, Claude functionality will be disabled")
            self.client = None
        else:
            self.client = anthropic.Anthropic(
                api_key=settings.CLAUDE_API_KEY, default_headers={"anthropic-beta": "files-api-2025-04-14"}
            )
        self.max_retries = 3
        self.retry_delay = 1.0  # seconds

    async def upload_file(self, file_path: str, filename: str) -> Optional[FileObject]:
        """
        Upload a file to Claude Files API.

        Args:
            file_path: Local path to the file
            filename: Original filename for the upload

        Returns:
            FileObject from Claude API, or None if upload failed
        """
        if not self.client:
            print("Claude client not initialized")
            return None

        try:
            # Check if PDF needs truncation due to Claude's 100-page limit
            actual_file_path = file_path
            was_truncated = False
            original_pages = 0
            if file_path.lower().endswith(".pdf"):
                from app.services.document_converter import document_converter

                actual_file_path, was_truncated, original_pages = await document_converter.truncate_pdf_if_needed(
                    file_path, max_pages=100
                )
                if was_truncated:
                    print(f"⚠️ PDF was truncated from {original_pages} to 100 pages for Claude API compatibility")

            # Read file content
            async with aiofiles.open(actual_file_path, "rb") as f:
                file_content = await f.read()

            # Determine content type
            self._get_content_type(file_path)

            # Create a file-like object from bytes
            import io

            file_obj = io.BytesIO(file_content)
            file_obj.name = filename

            # Upload to Claude Files API with beta header
            file_object = await asyncio.to_thread(
                self.client.beta.files.upload, file=file_obj, betas=["files-api-2025-04-14"]
            )

            return file_object

        except Exception as e:
            print(f"Error uploading file to Claude: {e}")
            return None

    def _get_content_type(self, file_path: str) -> str:
        """Determine content type based on file extension."""
        extension = Path(file_path).suffix.lower()

        content_types = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }

        return content_types.get(extension, "application/octet-stream")

    async def delete_file(self, file_id: str) -> bool:
        """
        Delete a file from Claude Files API.

        Args:
            file_id: Claude file ID to delete

        Returns:
            True if deletion was successful
        """
        if not self.client:
            return False

        try:
            await asyncio.to_thread(self.client.beta.files.delete, file_id=file_id)
            return True
        except Exception as e:
            print(f"Error deleting file from Claude: {e}")
            return False

    async def get_file_info(self, file_id: str) -> Optional[FileObject]:
        """
        Get information about an uploaded file.

        Args:
            file_id: Claude file ID

        Returns:
            FileObject with file information, or None if not found
        """
        if not self.client:
            return None

        try:
            file_object = await asyncio.to_thread(self.client.beta.files.retrieve, file_id=file_id)
            return file_object
        except Exception as e:
            print(f"Error retrieving file info from Claude: {e}")
            return None

    async def generate_content(
        self,
        prompt_text: str,
        file_ids: List[str],
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 8192,
        temperature: float = 0.1,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[int]]:
        """
        Generate content using Claude Messages API with uploaded files.

        Args:
            prompt_text: The prompt text for generation
            file_ids: List of Claude file IDs to include
            model: Claude model to use
            max_tokens: Maximum tokens in response
            temperature: Generation temperature

        Returns:
            Tuple of (generated_content, error_message, tokens_used)
        """
        if not self.client:
            return None, "Claude client not initialized", None

        try:
            # Build content array with files and text
            content = []

            # Add document references
            for file_id in file_ids:
                content.append({"type": "document", "source": {"type": "file", "file_id": file_id}})

            # Add the prompt text
            content.append({"type": "text", "text": prompt_text})

            # Make the API call with retry logic
            start_time = time.time()
            message = await self._call_messages_api_with_retry(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": content}],
            )
            generation_time = time.time() - start_time

            if not message:
                return None, "Failed to get response from Claude API", None

            # Extract content from response
            response_content = self._extract_response_content(message)
            if not response_content:
                return None, "Empty response from Claude API", None

            # Try to extract JSON from the response
            try:
                # Look for JSON in the response
                json_content = self._extract_json_from_response(response_content)
                if json_content:
                    return (
                        {
                            "generated_json": json_content,
                            "raw_response": response_content,
                            "generation_time": generation_time,
                            "model_used": model,
                        },
                        None,
                        message.usage.output_tokens if message.usage else None,
                    )
                else:
                    return (
                        {
                            "raw_response": response_content,
                            "generation_time": generation_time,
                            "model_used": model,
                            "warning": "No valid JSON found in response",
                        },
                        None,
                        message.usage.output_tokens if message.usage else None,
                    )

            except Exception as e:
                return None, f"Error processing Claude response: {str(e)}", None

        except Exception as e:
            return None, f"Error generating content with Claude: {str(e)}", None

    async def _call_messages_api_with_retry(
        self, model: str, max_tokens: int, temperature: float, messages: List[Dict[str, Any]]
    ) -> Optional[Message]:
        """Call Messages API with retry logic for rate limiting."""

        for attempt in range(self.max_retries):
            try:
                message = await asyncio.to_thread(
                    self.client.messages.create,
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=messages,
                )
                return message

            except anthropic.RateLimitError as e:
                if attempt < self.max_retries - 1:
                    delay = self.retry_delay * (2**attempt)  # Exponential backoff
                    print(f"Rate limited, retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    print(f"Rate limit exceeded after {self.max_retries} attempts")
                    raise e

            except Exception as e:
                print(f"Error calling Messages API (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
                    continue
                else:
                    raise e

        return None

    def _extract_response_content(self, message: Message) -> str:
        """Extract text content from Claude message response."""
        try:
            if message.content:
                # Handle different content types
                text_parts = []
                for content_block in message.content:
                    if hasattr(content_block, "text"):
                        text_parts.append(content_block.text)
                    elif hasattr(content_block, "type") and content_block.type == "text":
                        text_parts.append(content_block.text)

                return "\n".join(text_parts)
        except Exception as e:
            print(f"Error extracting response content: {e}")

        return ""

    def _extract_json_from_response(self, response_text: str) -> Optional[Dict[str, Any]]:
        """
        Extract JSON content from Claude's response using a robust parsing approach.
        """
        import json

        # Method 1: Look for JSON code blocks first (most reliable)
        code_block_patterns = [r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```"]

        import re

        for pattern in code_block_patterns:
            matches = re.findall(pattern, response_text, re.DOTALL)
            for match in matches:
                try:
                    parsed = json.loads(match.strip())
                    if isinstance(parsed, dict) and self._is_valid_nlj_structure(parsed):
                        return parsed
                except json.JSONDecodeError:
                    continue

        # Method 2: Use a JSON decoder that can handle partial streams
        # This is much more robust than regex
        def extract_json_objects(text: str):
            """Extract all valid JSON objects from text using incremental parsing."""
            decoder = json.JSONDecoder()
            idx = 0
            objects = []

            while idx < len(text):
                text_slice = text[idx:].lstrip()
                if not text_slice:
                    break

                if text_slice[0] == "{":
                    try:
                        obj, end_idx = decoder.raw_decode(text_slice)
                        if isinstance(obj, dict):
                            objects.append(obj)
                        idx += end_idx + (len(text[idx:]) - len(text_slice))
                    except json.JSONDecodeError:
                        idx += 1
                else:
                    idx += 1

            return objects

        # Try to extract JSON objects from the response
        try:
            json_objects = extract_json_objects(response_text)

            # Sort by preference: complete NLJ schemas first, then by size
            def score_json_object(obj):
                if not isinstance(obj, dict):
                    return 0
                score = len(str(obj))  # Base score on size
                if "nodes" in obj and "links" in obj and "id" in obj:
                    score += 10000  # Heavily prefer complete NLJ schemas
                elif "nodes" in obj or "links" in obj:
                    score += 1000  # Somewhat prefer partial NLJ structures
                return score

            json_objects.sort(key=score_json_object, reverse=True)

            # Return the best candidate
            for obj in json_objects:
                if self._is_valid_nlj_structure(obj):
                    return obj

            # If no perfect match, return the largest object that looks reasonable
            for obj in json_objects:
                if isinstance(obj, dict) and len(obj) > 2:
                    return obj

        except Exception as e:
            print(f"Error in JSON extraction: {e}")

        return None

    def _is_valid_nlj_structure(self, obj: Dict[str, Any]) -> bool:
        """Check if an object looks like a valid NLJ structure."""
        if not isinstance(obj, dict):
            return False

        # Must have basic NLJ fields
        required_fields = ["id", "name", "nodes", "links"]
        has_required = all(field in obj for field in required_fields)

        if has_required:
            # Validate nodes and links are arrays
            return isinstance(obj.get("nodes"), list) and isinstance(obj.get("links"), list)

        return False

    async def validate_nlj_schema(self, nlj_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate NLJ schema structure.

        Args:
            nlj_data: The NLJ data to validate

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        try:
            # Check required top-level fields
            required_fields = ["id", "name", "nodes", "links"]
            for field in required_fields:
                if field not in nlj_data:
                    errors.append(f"Missing required field: {field}")

            # Validate nodes structure
            if "nodes" in nlj_data:
                nodes = nlj_data["nodes"]
                if not isinstance(nodes, list):
                    errors.append("'nodes' must be an array")
                else:
                    node_ids = set()
                    for i, node in enumerate(nodes):
                        if not isinstance(node, dict):
                            errors.append(f"Node {i} must be an object")
                            continue

                        if "id" not in node:
                            errors.append(f"Node {i} missing 'id' field")
                        else:
                            node_id = node["id"]
                            if node_id in node_ids:
                                errors.append(f"Duplicate node ID: {node_id}")
                            node_ids.add(node_id)

                        if "type" not in node:
                            errors.append(f"Node {i} ({node.get('id', 'unknown')}) missing 'type' field")

            # Validate links structure
            if "links" in nlj_data:
                links = nlj_data["links"]
                if not isinstance(links, list):
                    errors.append("'links' must be an array")
                else:
                    node_ids = {node.get("id") for node in nlj_data.get("nodes", [])}
                    for i, link in enumerate(links):
                        if not isinstance(link, dict):
                            errors.append(f"Link {i} must be an object")
                            continue

                        required_link_fields = ["sourceNodeId", "targetNodeId"]
                        for field in required_link_fields:
                            if field not in link:
                                errors.append(f"Link {i} missing '{field}' field")

                        # Check if referenced nodes exist
                        source_id = link.get("sourceNodeId")
                        target_id = link.get("targetNodeId")

                        if source_id and source_id not in node_ids:
                            errors.append(f"Link {i} references non-existent source node: {source_id}")

                        if target_id and target_id not in node_ids:
                            errors.append(f"Link {i} references non-existent target node: {target_id}")

            # Check for start and end nodes
            if "nodes" in nlj_data:
                node_types = [node.get("type") for node in nlj_data["nodes"]]
                if "start" not in node_types:
                    errors.append("Scenario must have a 'start' node")
                if "end" not in node_types:
                    errors.append("Scenario must have an 'end' node")

        except Exception as e:
            errors.append(f"Schema validation error: {str(e)}")

        return len(errors) == 0, errors

    async def generate_content_with_file(
        self,
        file_id: str,
        prompt: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> Optional[str]:
        """
        Generate content using Claude Messages API with a single file.
        Convenience method for single-file generation.

        Args:
            file_id: Claude file ID to analyze
            prompt: The prompt text for generation
            model: Claude model to use
            max_tokens: Maximum tokens in response
            temperature: Generation temperature

        Returns:
            Generated content as string or None if failed
        """
        print(f"generate_content_with_file called with file_id: {file_id}")
        print(f"Client available: {self.client is not None}")

        if not self.client or not file_id:
            print(f"Missing client or file_id: client={self.client is not None}, file_id={file_id}")
            return None

        try:
            print("Calling generate_content...")
            content, error, tokens = await self.generate_content(
                prompt_text=prompt, file_ids=[file_id], model=model, max_tokens=max_tokens, temperature=temperature
            )

            print(f"generate_content returned: content={content}, error={error}, tokens={tokens}")

            if error:
                print(f"Error in generate_content_with_file: {error}")
                return None

            # Extract text content from the response
            if content and isinstance(content, dict):
                print(f"Content is dict with keys: {content.keys()}")
                # Handle different response formats
                if "raw_response" in content:
                    result = content["raw_response"]
                    print(f"Extracted text from raw_response: {result[:100]}...")
                    return result
                elif "content" in content:
                    if isinstance(content["content"], list) and len(content["content"]) > 0:
                        result = content["content"][0].get("text", "")
                        print(f"Extracted text from content[0]: {result[:100]}...")
                        return result
                    elif isinstance(content["content"], str):
                        print(f"Content is string: {content['content'][:100]}...")
                        return content["content"]
                elif "text" in content:
                    print(f"Found text field: {content['text'][:100]}...")
                    return content["text"]
                elif isinstance(content, str):
                    print(f"Content is direct string: {content[:100]}...")
                    return content
            else:
                print(f"Content is not dict or is empty: {type(content)}, {content}")

            return None

        except Exception as e:
            print(f"Exception in generate_content_with_file: {e}")
            import traceback

            traceback.print_exc()
            return None

    async def generate_content_with_file_and_prefill(
        self,
        file_id: str,
        prompt: str,
        prefill: str,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> Optional[str]:
        """
        Generate content using Claude Messages API with a single file and prefilling.
        Uses Anthropic's prefilling technique to force structured output.

        Args:
            file_id: Claude file ID to analyze
            prompt: The prompt text for generation
            prefill: Text to prefill the assistant response with (e.g., "{" for JSON)
            model: Claude model to use
            max_tokens: Maximum tokens in response
            temperature: Generation temperature

        Returns:
            Generated content as string or None if failed
        """
        print(f"generate_content_with_file_and_prefill called with file_id: {file_id}, prefill: '{prefill}'")
        print(f"Client available: {self.client is not None}")

        if not self.client or not file_id:
            print(f"Missing client or file_id: client={self.client is not None}, file_id={file_id}")
            return None

        try:
            # Build content array with files and text
            content = []

            # Add document reference
            content.append({"type": "document", "source": {"type": "file", "file_id": file_id}})

            # Add the prompt text
            content.append({"type": "text", "text": prompt})

            # Build messages with prefilling
            messages = [{"role": "user", "content": content}, {"role": "assistant", "content": prefill}]

            print("Calling Messages API with prefilling...")
            message = await self._call_messages_api_with_retry(
                model=model, max_tokens=max_tokens, temperature=temperature, messages=messages
            )

            if not message:
                print("Failed to get response from Claude API")
                return None

            # Extract content from response
            response_content = self._extract_response_content(message)
            if not response_content:
                print("Empty response from Claude API")
                return None

            # With prefilling, the response should be direct JSON (no markdown wrapping)
            # Prepend the prefill text to complete the JSON
            full_response = prefill + response_content
            print(f"Full response with prefill: {full_response[:200]}...")

            return full_response

        except Exception as e:
            print(f"Exception in generate_content_with_file_and_prefill: {e}")
            import traceback

            traceback.print_exc()
            return None


# Global instance
claude_service = ClaudeService()
