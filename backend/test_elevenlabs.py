#!/usr/bin/env python3
"""
Test script to verify ElevenLabs API functionality
"""

import asyncio
import os
from app.services.elevenlabs_service import elevenlabs_service


async def test_elevenlabs():
    """Test ElevenLabs API connection and basic TTS"""
    
    print("Testing ElevenLabs API...")
    print(f"API Key configured: {'Yes' if elevenlabs_service.api_key else 'No'}")
    
    if elevenlabs_service.api_key:
        print(f"API Key starts with: {elevenlabs_service.api_key[:10]}...")
    
    # Test API connection
    try:
        connection_test = await elevenlabs_service.test_api_connection()
        print(f"API Connection test: {'Success' if connection_test else 'Failed'}")
    except Exception as e:
        print(f"API Connection test failed: {e}")
    
    # Test getting voices
    try:
        voices = await elevenlabs_service.get_available_voices()
        print(f"Available voices: {len(voices)}")
        for voice in voices[:3]:  # Show first 3 voices
            print(f"  - {voice.get('name', 'Unknown')} ({voice.get('voice_id', 'No ID')})")
    except Exception as e:
        print(f"Failed to get voices: {e}")
    
    # Test simple TTS generation
    try:
        print("Testing simple TTS generation...")
        test_text = "Hello, this is a test of the ElevenLabs text to speech service."
        voice_id = elevenlabs_service.get_voice_id_for_type("female_professional")
        print(f"Using voice ID: {voice_id}")
        
        audio_data = await elevenlabs_service.generate_speech(
            text=test_text,
            voice_id=voice_id
        )
        print(f"Generated {len(audio_data)} bytes of audio")
        
        # Save test file
        with open("/tmp/test_audio.mp3", "wb") as f:
            f.write(audio_data)
        print("Test audio saved to /tmp/test_audio.mp3")
        
    except Exception as e:
        print(f"TTS generation test failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_elevenlabs())