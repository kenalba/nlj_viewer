"""
ElevenLabs TTS service for audio generation.
Handles text-to-speech conversion using ElevenLabs API.
"""

from typing import Any, Dict, List, Optional

import aiofiles
import aiohttp

from app.core.config import settings


class ElevenLabsService:
    """
    Service for interacting with ElevenLabs TTS API.
    Handles voice synthesis and voice management.
    """

    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY if hasattr(settings, "ELEVENLABS_API_KEY") else None
        self.base_url = "https://api.elevenlabs.io/v1"
        self.default_voices = {
            "male_professional": "XrExE9yKIg1WjnnlVkGX",  # Guest voice (male professional)
            "female_professional": "bIHbv24MWmeRgasZH58o",  # Host voice (female professional)
            "male_conversational": "VR6AewLTigWG4xSOukaG",  # Josh (conversational male)
            "female_conversational": "EXAVITQu4vr4xnSDxMaL",  # Bella (conversational female)
        }

        if not self.api_key:
            print("Warning: ELEVENLABS_API_KEY not set, TTS functionality will be disabled")

    async def generate_speech(
        self,
        text: str,
        voice_id: str,
        model_id: str = "eleven_multilingual_v2",
        voice_settings: Optional[Dict[str, Any]] = None,
        output_format: str = "mp3_44100_128",
    ) -> bytes:
        """
        Generate speech from text using ElevenLabs API.

        Args:
            text: Text to convert to speech
            voice_id: ElevenLabs voice ID
            model_id: Model to use for generation
            voice_settings: Voice configuration (stability, similarity_boost, etc.)
            output_format: Audio output format

        Returns:
            Audio data as bytes
        """
        if not self.api_key:
            print("ERROR: ElevenLabs API key not configured - TTS generation will fail")
            raise ValueError("ElevenLabs API key not configured")

        if not voice_settings:
            voice_settings = {"stability": 0.75, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True}

        url = f"{self.base_url}/text-to-speech/{voice_id}"

        headers = {
            "Accept": f"audio/{output_format.split('_')[0]}",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key,
        }

        data = {"text": text, "model_id": model_id, "voice_settings": voice_settings}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=data) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"ElevenLabs API error: {response.status} - {error_text}")

                return await response.read()

    async def generate_speech_with_speakers(
        self,
        script_segments: List[Dict[str, str]],
        voice_mapping: Dict[str, str],
        output_path: str,
        voice_settings: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate speech for a multi-speaker script.

        Args:
            script_segments: List of {"speaker": "name", "text": "content"} segments
            voice_mapping: Mapping of speaker names to voice IDs
            output_path: Where to save the final audio file
            voice_settings: Voice configuration

        Returns:
            Dict with generation info (duration, file_size, etc.)
        """
        if not self.api_key:
            print("ERROR: ElevenLabs API key not configured - Multi-speaker TTS generation will fail")
            raise ValueError("ElevenLabs API key not configured")

        audio_segments = []
        total_characters = 0

        for segment in script_segments:
            speaker = segment.get("speaker", "narrator")
            text = segment.get("text", "")

            if not text.strip():
                continue

            voice_id = voice_mapping.get(speaker, list(voice_mapping.values())[0])

            print(f"Generating audio for {speaker}: {text[:50]}...")

            try:
                audio_data = await self.generate_speech(text=text, voice_id=voice_id, voice_settings=voice_settings)

                audio_segments.append(audio_data)
                total_characters += len(text)
                print(f"Successfully generated {len(audio_data)} bytes of audio for {speaker}")

            except Exception as e:
                print(f"ERROR: Failed to generate audio for {speaker}: {e}")
                raise

        # Combine audio segments (simple concatenation for MP3)
        combined_audio = b"".join(audio_segments)

        # Save to file
        async with aiofiles.open(output_path, "wb") as f:
            await f.write(combined_audio)

        # Get file size
        file_size = len(combined_audio)

        # Estimate duration (rough calculation: ~150 words per minute, ~5 chars per word)
        estimated_duration = int((total_characters / 5) / 150 * 60)

        return {
            "file_path": output_path,
            "file_size": file_size,
            "duration": estimated_duration,
            "character_count": total_characters,
            "segment_count": len([s for s in script_segments if s.get("text", "").strip()]),
        }

    async def get_available_voices(self) -> List[Dict[str, Any]]:
        """
        Get list of available voices from ElevenLabs.

        Returns:
            List of voice information
        """
        if not self.api_key:
            # Return default voice options when API key not available
            return [
                {
                    "voice_id": "male_professional",
                    "name": "Professional Male",
                    "gender": "male",
                    "language": "en",
                    "style": "professional",
                    "preview_url": None,
                },
                {
                    "voice_id": "female_professional",
                    "name": "Professional Female",
                    "gender": "female",
                    "language": "en",
                    "style": "professional",
                    "preview_url": None,
                },
                {
                    "voice_id": "male_conversational",
                    "name": "Conversational Male",
                    "gender": "male",
                    "language": "en",
                    "style": "conversational",
                    "preview_url": None,
                },
                {
                    "voice_id": "female_conversational",
                    "name": "Conversational Female",
                    "gender": "female",
                    "language": "en",
                    "style": "conversational",
                    "preview_url": None,
                },
            ]

        url = f"{self.base_url}/voices"
        headers = {"xi-api-key": self.api_key}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status != 200:
                        print(f"Failed to fetch voices: {response.status}")
                        return []

                    data = await response.json()
                    voices = []

                    for voice in data.get("voices", []):
                        voices.append(
                            {
                                "voice_id": voice["voice_id"],
                                "name": voice["name"],
                                "gender": self._guess_gender(voice["name"]),
                                "language": voice.get("language", "en"),
                                "style": self._guess_style(voice["name"]),
                                "preview_url": voice.get("preview_url"),
                            }
                        )

                    return voices

        except Exception as e:
            print(f"Error fetching voices: {e}")
            return []

    def _guess_gender(self, name: str) -> str:
        """Guess gender from voice name (fallback method)."""
        male_names = ["adam", "josh", "arnold", "sam", "thomas", "jeremy", "michael"]
        female_names = ["rachel", "domi", "bella", "elli", "dorothy", "sarah", "emily"]

        name_lower = name.lower()
        if any(male in name_lower for male in male_names):
            return "male"
        elif any(female in name_lower for female in female_names):
            return "female"
        return "neutral"

    def _guess_style(self, name: str) -> str:
        """Guess style from voice name (fallback method)."""
        if "professional" in name.lower():
            return "professional"
        elif "conversational" in name.lower() or "friendly" in name.lower():
            return "conversational"
        return "neutral"

    def get_voice_id_for_type(self, voice_type: str) -> str:
        """Get ElevenLabs voice ID for a voice type."""
        return self.default_voices.get(voice_type, self.default_voices["female_professional"])

    async def test_api_connection(self) -> bool:
        """Test if ElevenLabs API is accessible."""
        if not self.api_key:
            return False

        try:
            voices = await self.get_available_voices()
            return len(voices) > 0
        except Exception:
            return False


# Global service instance
elevenlabs_service = ElevenLabsService()
