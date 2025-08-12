"""
Document conversion service for Content Studio.
Handles conversion of DOCX/PPTX documents to PDF for optimal Claude analysis.
"""

import asyncio
import os
import tempfile

try:
    import magic

    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import aiofiles
from docx import Document
from pypdf import PdfReader, PdfWriter


@dataclass
class DocumentMetadata:
    """Extracted document metadata."""

    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    creator: Optional[str] = None
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    page_count: Optional[int] = None
    file_size: int = 0


class DocumentConverter:
    """
    Document conversion service for Content Studio.
    Handles conversion to PDF and metadata extraction.
    """

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "nlj_conversions"
        self.temp_dir.mkdir(exist_ok=True)

    async def detect_file_type(self, file_path: str) -> str:
        """
        Detect file type using python-magic if available, otherwise file extension.

        Args:
            file_path: Path to the file

        Returns:
            File type (pdf, docx, pptx, txt, etc.)
        """
        try:
            if HAS_MAGIC:
                mime_type = magic.from_file(file_path, mime=True)

                if mime_type == "application/pdf":
                    return "pdf"
                elif mime_type in [
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/msword",
                ]:
                    return "docx"
                elif mime_type in [
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "application/vnd.ms-powerpoint",
                ]:
                    return "pptx"
                elif mime_type == "text/plain":
                    return "txt"

            # Fallback to extension-based detection
            extension = Path(file_path).suffix.lower()
            if extension == ".pdf":
                return "pdf"
            elif extension in [".docx", ".doc"]:
                return "docx"
            elif extension in [".pptx", ".ppt"]:
                return "pptx"
            elif extension == ".txt":
                return "txt"
            else:
                return "unknown"

        except Exception as e:
            print(f"Error detecting file type for {file_path}: {e}")
            # Final fallback to extension
            extension = Path(file_path).suffix.lower()
            return extension[1:] if extension else "unknown"

    async def extract_metadata(self, file_path: str, file_type: str) -> DocumentMetadata:
        """
        Extract metadata from document.

        Args:
            file_path: Path to the file
            file_type: Detected file type

        Returns:
            DocumentMetadata object
        """
        metadata = DocumentMetadata()

        try:
            # Get file size
            metadata.file_size = os.path.getsize(file_path)

            if file_type == "pdf":
                metadata = await self._extract_pdf_metadata(file_path, metadata)
            elif file_type == "docx":
                metadata = await self._extract_docx_metadata(file_path, metadata)
            # Note: PPTX metadata extraction would require python-pptx library
            # For now, we'll skip PPTX metadata extraction

        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")

        return metadata

    async def _extract_pdf_metadata(self, file_path: str, metadata: DocumentMetadata) -> DocumentMetadata:
        """Extract metadata from PDF file."""
        try:
            reader = PdfReader(file_path)

            metadata.page_count = len(reader.pages)

            if reader.metadata:
                metadata.title = reader.metadata.get("/Title")
                metadata.author = reader.metadata.get("/Author")
                metadata.subject = reader.metadata.get("/Subject")
                metadata.creator = reader.metadata.get("/Creator")

                # Handle creation date
                creation_date = reader.metadata.get("/CreationDate")
                if creation_date:
                    metadata.creation_date = str(creation_date)

                # Handle modification date
                mod_date = reader.metadata.get("/ModDate")
                if mod_date:
                    metadata.modification_date = str(mod_date)

        except Exception as e:
            print(f"Error extracting PDF metadata: {e}")

        return metadata

    async def _extract_docx_metadata(self, file_path: str, metadata: DocumentMetadata) -> DocumentMetadata:
        """Extract metadata from DOCX file."""
        try:
            doc = Document(file_path)

            if doc.core_properties:
                props = doc.core_properties
                metadata.title = props.title
                metadata.author = props.author
                metadata.subject = props.subject
                metadata.creator = props.creator

                if props.created:
                    metadata.creation_date = props.created.isoformat()
                if props.modified:
                    metadata.modification_date = props.modified.isoformat()

        except Exception as e:
            print(f"Error extracting DOCX metadata: {e}")

        return metadata

    async def truncate_pdf_if_needed(self, pdf_path: str, max_pages: int = 100) -> tuple[str, bool, int]:
        """
        Truncate PDF to maximum number of pages if it exceeds the limit.

        Args:
            pdf_path: Path to the PDF file
            max_pages: Maximum number of pages to keep (default: 100 for Claude API)

        Returns:
            Tuple of (file_path, was_truncated, original_page_count)
        """
        try:
            reader = PdfReader(pdf_path)
            page_count = len(reader.pages)

            print(f"📄 PDF has {page_count} pages, Claude limit is {max_pages} pages")

            if page_count <= max_pages:
                print("✅ PDF is within limit, no truncation needed")
                return pdf_path, False, page_count

            print(f"✂️ Truncating PDF from {page_count} to {max_pages} pages")

            # Create truncated version
            writer = PdfWriter()
            for i in range(min(max_pages, page_count)):
                writer.add_page(reader.pages[i])

            # Create new filename for truncated version
            path_obj = Path(pdf_path)
            truncated_path = path_obj.parent / f"{path_obj.stem}_truncated{path_obj.suffix}"

            # Write truncated PDF
            with open(truncated_path, "wb") as output_file:
                writer.write(output_file)

            print(f"✅ Created truncated PDF: {truncated_path}")
            return str(truncated_path), True, page_count

        except Exception as e:
            print(f"❌ Error truncating PDF: {e}")
            # Return original file if truncation fails, but report the issue
            return pdf_path, False, page_count if "page_count" in locals() else 0

    async def convert_to_pdf(self, input_path: str, file_type: str) -> Optional[str]:
        """
        Convert document to PDF format.

        Args:
            input_path: Path to input file
            file_type: Type of input file

        Returns:
            Path to converted PDF file, or None if conversion failed
        """
        if file_type == "pdf":
            # Already PDF, no conversion needed
            return input_path

        if file_type == "txt":
            # For text files, we'll create a simple PDF
            return await self._convert_text_to_pdf(input_path)

        if file_type in ["docx", "pptx"]:
            return await self._convert_office_to_pdf(input_path, file_type)

        # Unsupported file type
        return None

    async def _convert_text_to_pdf(self, input_path: str) -> Optional[str]:
        """Convert text file to PDF using simple HTML to PDF conversion."""
        try:
            # Generate output path
            input_name = Path(input_path).stem
            output_path = self.temp_dir / f"{input_name}_converted.pdf"

            # Read text content
            async with aiofiles.open(input_path, "r", encoding="utf-8") as f:
                content = await f.read()

            # Create simple HTML
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }}
                    pre {{ white-space: pre-wrap; word-wrap: break-word; }}
                </style>
            </head>
            <body>
                <pre>{content}</pre>
            </body>
            </html>
            """

            # Write HTML to temp file
            html_path = self.temp_dir / f"{input_name}_temp.html"
            async with aiofiles.open(html_path, "w", encoding="utf-8") as f:
                await f.write(html_content)

            # Convert HTML to PDF using wkhtmltopdf (if available)
            try:
                cmd = ["wkhtmltopdf", "--page-size", "A4", str(html_path), str(output_path)]
                process = await asyncio.create_subprocess_exec(
                    *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()

                if process.returncode == 0:
                    # Clean up temp HTML
                    os.unlink(html_path)
                    return str(output_path)
                else:
                    print(f"wkhtmltopdf error: {stderr.decode()}")
            except FileNotFoundError:
                print("wkhtmltopdf not found, text to PDF conversion not available")

            # Clean up temp files
            if html_path.exists():
                os.unlink(html_path)

        except Exception as e:
            print(f"Error converting text to PDF: {e}")

        return None

    async def _convert_office_to_pdf(self, input_path: str, file_type: str) -> Optional[str]:
        """Convert Office documents to PDF using LibreOffice."""
        try:
            # Generate output path
            input_name = Path(input_path).stem
            output_path = self.temp_dir / f"{input_name}_converted.pdf"

            # Use LibreOffice headless mode for conversion
            cmd = ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(self.temp_dir), input_path]

            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                # LibreOffice creates the PDF with the same base name
                expected_output = self.temp_dir / f"{input_name}.pdf"
                if expected_output.exists():
                    # Rename to our expected output path
                    if expected_output != output_path:
                        expected_output.rename(output_path)
                    return str(output_path)
            else:
                print(f"LibreOffice conversion error: {stderr.decode()}")

        except FileNotFoundError:
            print("LibreOffice not found, Office document conversion not available")
        except Exception as e:
            print(f"Error converting Office document to PDF: {e}")

        return None

    def cleanup_temp_file(self, file_path: str) -> None:
        """Clean up temporary file."""
        try:
            if os.path.exists(file_path) and str(file_path).startswith(str(self.temp_dir)):
                os.unlink(file_path)
        except Exception as e:
            print(f"Error cleaning up temp file {file_path}: {e}")

    def cleanup_old_temp_files(self, max_age_hours: int = 24) -> None:
        """Clean up old temporary files."""
        import time

        current_time = time.time()
        max_age_seconds = max_age_hours * 3600

        try:
            for file_path in self.temp_dir.iterdir():
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        file_path.unlink()
        except Exception as e:
            print(f"Error cleaning up old temp files: {e}")


# Global instance
document_converter = DocumentConverter()
