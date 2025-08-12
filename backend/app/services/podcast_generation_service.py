"""
Podcast generation service that combines Claude script generation with ElevenLabs TTS.
"""

import re
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media import MediaItem
from app.models.source_document import SourceDocument
from app.services.claude_service import claude_service
from app.services.elevenlabs_service import elevenlabs_service
from app.services.media_service import media_service
from app.services.source_document_service import SourceDocumentService


class PodcastGenerationService:
    """
    Service for generating NPR-style podcasts from source documents.
    Handles the full pipeline from script generation to audio synthesis.
    """

    def __init__(self):
        self.default_voice_mapping = {
            "host": "female_professional",  # bIHbv24MWmeRgasZH58o
            "guest": "male_professional",  # XrExE9yKIg1WjnnlVkGX
            "narrator": "female_conversational",
        }

    async def generate_podcast_async(self, media_id: uuid.UUID, db: AsyncSession) -> None:
        """
        Generate podcast asynchronously (called from background task).

        Args:
            media_id: ID of the media item to generate
            db: Database session
        """
        try:
            # Get media item
            query = select(MediaItem).where(MediaItem.id == media_id)
            result = await db.execute(query)
            media_item = result.scalar_one_or_none()

            if not media_item:
                print(f"Media item {media_id} not found")
                return

            # Get source document
            source_doc_service = SourceDocumentService(db)
            source_document = await source_doc_service.get_document_by_id(
                media_item.source_document_id, media_item.created_by
            )

            if not source_document:
                await media_service.mark_generation_failed(db, media_id, "Source document not found")
                return

            # Generate script
            print(f"Generating script for media {media_id}...")
            script = await self._generate_npr_script(
                source_document,
                media_item.selected_keywords,
                media_item.selected_objectives,
                media_item.media_style or "npr_interview",
            )

            if not script:
                await media_service.mark_generation_failed(db, media_id, "Failed to generate script")
                return

            # Parse script into segments
            script_segments = self._parse_script_segments(script)

            # Generate audio
            print(f"Generating audio for media {media_id}...")
            output_path = media_service.get_media_file_path(media_id, media_item.media_type)

            voice_config = media_item.voice_config or {}
            voice_mapping = self._build_voice_mapping(voice_config)

            audio_result = await elevenlabs_service.generate_speech_with_speakers(
                script_segments=script_segments, voice_mapping=voice_mapping, output_path=output_path
            )

            # Update media item with completion
            await media_service.mark_generation_completed(
                db=db,
                media_id=media_id,
                file_path=audio_result["file_path"],
                file_size=audio_result["file_size"],
                mime_type="audio/mpeg",
                duration=audio_result["duration"],
                transcript=script,
            )

            # Update title with better name
            if media_item.title.startswith("Podcast:"):
                better_title = self._generate_title_from_script(script, source_document.get_display_name())
                media_item.title = better_title
                await db.commit()

            print(f"Successfully generated podcast {media_id}")

        except Exception as e:
            print(f"Error generating podcast {media_id}: {e}")
            await media_service.mark_generation_failed(db, media_id, str(e))

    async def generate_script_only(
        self,
        source_document_id: uuid.UUID,
        selected_keywords: List[str],
        selected_objectives: List[str],
        db: AsyncSession,
        style: str = "npr_interview",
        length_preference: str = "medium",
        conversation_depth: str = "balanced",
    ) -> Dict[str, Any]:
        """
        Generate only the podcast script without audio.

        Returns:
            Dict with script data
        """
        # Get source document directly from database
        result = await db.execute(select(SourceDocument).where(SourceDocument.id == source_document_id))
        source_document = result.scalar_one_or_none()

        if not source_document:
            raise ValueError("Source document not found")

        script = await self._generate_npr_script(
            source_document, selected_keywords, selected_objectives, style, length_preference, conversation_depth
        )

        if not script:
            raise ValueError("Failed to generate script")

        # Analyze script
        script_segments = self._parse_script_segments(script)
        word_count = len(script.split())
        estimated_duration = int(word_count / 150 * 60)  # ~150 WPM
        speaker_count = len(set(seg.get("speaker", "narrator") for seg in script_segments))
        key_topics = selected_keywords[:5]  # Use selected keywords as topics

        return {
            "script": script,
            "estimated_duration": estimated_duration,
            "word_count": word_count,
            "speaker_count": speaker_count,
            "key_topics": key_topics,
            "source_attribution": f"Generated from: {source_document.get_display_name()}",
        }

    async def _generate_npr_script(
        self,
        source_document: SourceDocument,
        selected_keywords: List[str],
        selected_objectives: List[str],
        style: str = "npr_interview",
        length_preference: str = "medium",
        conversation_depth: str = "balanced",
    ) -> Optional[str]:
        """
        Generate NPR-style script using Claude.
        """
        # Ensure document is uploaded to Claude
        source_doc_service = SourceDocumentService(None)
        if source_document.needs_reupload():
            success = await source_doc_service.upload_to_claude(source_document)
            if not success:
                return None

        # Build generation prompt
        prompt = self._build_script_generation_prompt(
            source_document, selected_keywords, selected_objectives, style, length_preference, conversation_depth
        )

        # Generate script using Claude
        script = await claude_service.generate_content_with_file(
            file_id=source_document.claude_file_id, prompt=prompt, max_tokens=4096, temperature=0.3
        )

        return script

    def _build_script_generation_prompt(
        self,
        source_document: SourceDocument,
        selected_keywords: List[str],
        selected_objectives: List[str],
        style: str,
        length_preference: str,
        conversation_depth: str,
    ) -> str:
        """Build the prompt for script generation."""

        length_guidance = {
            "short": "3-5 minutes (500-800 words)",
            "medium": "5-8 minutes (800-1200 words)",
            "long": "8-12 minutes (1200-1800 words)",
        }

        depth_guidance = {
            "surface": "high-level overview with key points",
            "balanced": "moderate detail with examples and context",
            "deep": "thorough analysis with nuanced discussion",
        }

        keywords_text = ", ".join(selected_keywords) if selected_keywords else "all key concepts"
        objectives_text = (
            "\n".join(f"- {obj}" for obj in selected_objectives)
            if selected_objectives
            else "- Provide informative overview\n- Engage listeners with key insights"
        )

        prompt = f"""Create an NPR-style podcast script based on this document. 

**Style**: {style.replace('_', ' ').title()}
**Target Length**: {length_guidance.get(length_preference, '5-8 minutes (800-1200 words)')}
**Conversation Depth**: {depth_guidance.get(conversation_depth, 'moderate detail with examples')}

**Focus Keywords**: {keywords_text}

**Learning Objectives**:
{objectives_text}

**Script Requirements**:
1. **Format**: Use clear speaker labels (HOST:, GUEST:, NARRATOR:)
2. **NPR Style**: Natural, conversational tone with thoughtful questions and insights. Include natural speech patterns like occasional "um," "uh," "you know," and "I mean" to make the conversation sound authentic and human
3. **Structure**: 
   - Brief introduction/hook (30 seconds)
   - Main discussion covering key points (70% of content)
   - Practical takeaways or implications (20% of content)
   - Closing with source attribution (10 seconds)

4. **Content Guidelines**:
   - Draw directly from the document's content
   - Use specific examples and data when available
   - Maintain accuracy while making content accessible
   - Include natural conversation flow with follow-up questions
   - Add brief transitions between topics
   - Use natural speech patterns including occasional hesitations ("um," "uh"), emphasis words ("you know," "I mean," "actually"), and conversational connectors ("so," "well," "right")

5. **Speaker Roles**:
   - HOST: Asks thoughtful questions, provides context, guides conversation
   - GUEST: Acts as expert explaining concepts from the document
   - NARRATOR: Provides brief transitions or factual context when needed

**Example Format**:
```
NARRATOR: Welcome to today's discussion on [topic].

HOST: I'm here with our expert to explore [key theme from document]. So, let's start with the basics - what should our listeners know about [first key concept]?

GUEST: Well, that's a great question. Um, according to the research, [specific insight from document]... and, you know, what's really interesting is...

HOST: That's fascinating. I mean, can you give us a concrete example of how this works in practice?

GUEST: Actually, yes. So, [concrete example]...
```

Please generate a complete script that feels natural and informative, staying true to the source material while making it engaging for audio consumption.

**Important**: End with attribution like "The information for this podcast came from [document title/source]."
"""

        return prompt

    def _parse_script_segments(self, script: str) -> List[Dict[str, str]]:
        """
        Parse script into speaker segments.

        Returns:
            List of {"speaker": "name", "text": "content"} segments
        """
        segments = []
        lines = script.split("\n")
        current_speaker = None
        current_text = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if line starts with speaker label
            speaker_match = re.match(r"^(HOST|GUEST|NARRATOR|INTERVIEWER|EXPERT):\s*(.*)$", line, re.IGNORECASE)

            if speaker_match:
                # Save previous segment
                if current_speaker and current_text:
                    segments.append({"speaker": current_speaker.lower(), "text": " ".join(current_text).strip()})

                # Start new segment
                current_speaker = speaker_match.group(1).upper()
                current_text = [speaker_match.group(2)] if speaker_match.group(2) else []
            else:
                # Continue current segment
                if current_speaker:
                    current_text.append(line)

        # Save final segment
        if current_speaker and current_text:
            segments.append({"speaker": current_speaker.lower(), "text": " ".join(current_text).strip()})

        return segments

    def _build_voice_mapping(self, voice_config: Dict[str, Any]) -> Dict[str, str]:
        """Build mapping of speakers to ElevenLabs voice IDs."""
        voice_mapping = {}

        for speaker, voice_type in self.default_voice_mapping.items():
            # Use custom voice if specified in config
            custom_voice = voice_config.get(f"{speaker}_voice")
            if custom_voice:
                voice_mapping[speaker] = custom_voice
            else:
                voice_mapping[speaker] = elevenlabs_service.get_voice_id_for_type(voice_type)

        return voice_mapping

    def _generate_title_from_script(self, script: str, source_name: str) -> str:
        """Generate a better title from the script content."""
        # Extract first substantial line or topic
        lines = [line.strip() for line in script.split("\n") if line.strip()]

        for line in lines:
            if not line.startswith(("HOST:", "GUEST:", "NARRATOR:", "INTERVIEWER:")):
                continue

            # Remove speaker label and get first sentence
            content = re.sub(r"^(HOST|GUEST|NARRATOR|INTERVIEWER):\s*", "", line, flags=re.IGNORECASE)
            if len(content) > 20:
                # Extract first sentence or phrase
                first_sentence = content.split(".")[0].split("?")[0].split("!")[0]
                if 10 < len(first_sentence) < 80:
                    return f"Podcast: {first_sentence}"

        # Fallback to source-based title
        return f"Podcast: Insights from {source_name}"

    async def get_available_voices(self) -> List[Dict[str, Any]]:
        """Get available TTS voices."""
        return await elevenlabs_service.get_available_voices()

    async def generate_audio_from_transcript(
        self, transcript: str, voice_config: Dict[str, Any], output_format: str = "mp3", quality: str = "high"
    ) -> Dict[str, Any]:
        """Generate audio directly from transcript."""
        # This would be used for transcript editing workflow
        # Parse transcript and generate audio
        script_segments = self._parse_script_segments(transcript)
        voice_mapping = self._build_voice_mapping(voice_config)

        # Generate temporary file path
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            output_path = tmp_file.name

        audio_result = await elevenlabs_service.generate_speech_with_speakers(
            script_segments=script_segments, voice_mapping=voice_mapping, output_path=output_path
        )

        return {
            "audio_url": f"/media/temp/{audio_result['file_path']}",
            "duration": audio_result["duration"],
            "file_size": audio_result["file_size"],
            "format": output_format,
            "generation_time": 0.0,  # Would track actual generation time
        }


# Global service instance
podcast_generation_service = PodcastGenerationService()
