# Media Generator Pipeline

A comprehensive system for generating consumable media content (podcasts, videos, visual content) from source documents using AI-powered content generation and multi-modal synthesis.

## Overview

The Media Generator extends the existing NLJ platform's Content Studio capabilities to create passive consumption media alongside interactive learning activities. While Activities focus on learner interaction and assessment, Media provides consumable content for knowledge transfer and engagement.

## Architecture

### Core Pipeline Flow
```
Source Documents → Content Analysis → Script Generation → Media Synthesis → Media Library
```

### Content Types Hierarchy
- **Sources**: Raw input documents (PDFs, DOCX, PPTX)
- **Activities**: Interactive learning experiences (quizzes, scenarios)
- **Media**: Consumable content assets (podcasts, videos, images)

## Phase 1: Podcast Generation (MVP)

### Technical Stack
- **Script Generation**: Claude API (leveraging existing integration)
- **Text-to-Speech**: ElevenLabs API
- **Storage**: Separate S3 bucket/directory for media assets
- **Database**: New `MediaItem` model referencing `SourceDocument`

### User Flow
1. **Source Selection**: From SourceDetailPage → "Generate Podcast" button
2. **Configuration**: Podcast generation modal with options
3. **Script Generation**: AI-generated NPR-style conversational transcript
4. **Transcript Editing**: User review and modification interface
5. **Audio Generation**: TTS synthesis with male/female voices
6. **Media Management**: Save to Media Library with sharing capabilities

### Database Schema

#### MediaItem Model
```python
class MediaType(str, Enum):
    PODCAST = "podcast"
    VIDEO = "video"
    IMAGE = "image"
    INFOGRAPHIC = "infographic"

class MediaItem(Base):
    __tablename__ = "media_items"
    
    # Core fields
    id: UUID (primary key)
    title: str
    description: Optional[str]
    media_type: MediaType
    
    # Content fields
    transcript: Optional[str]  # For audio/video content
    duration: Optional[int]   # In seconds
    file_path: str           # Local storage path
    file_size: int           # File size in bytes
    mime_type: str           # audio/mpeg, video/mp4, etc.
    
    # Generation metadata
    generation_prompt: Optional[str]    # Original generation prompt
    selected_keywords: List[str]        # Keywords selected for focus
    selected_objectives: List[str]      # Learning objectives used
    generation_config: JSON             # Voice, style, length settings
    
    # Source tracking
    source_document_id: UUID (FK to SourceDocument)
    
    # Usage and sharing
    play_count: int (default=0)
    last_played_at: Optional[datetime]
    is_public: bool (default=False)
    share_token: Optional[str]         # For public sharing
    
    # Standard fields
    user_id: UUID (FK)
    created_at: datetime
    updated_at: datetime
```

### API Endpoints
```
POST /api/media/generate-podcast        # Initiate podcast generation
GET  /api/media                        # List user's media items
GET  /api/media/{id}                    # Get specific media item
PUT  /api/media/{id}                    # Update media metadata
DELETE /api/media/{id}                  # Delete media item
POST /api/media/{id}/share              # Generate public share link
GET  /api/shared/media/{token}          # Public media access
```

### Frontend Components
```
components/media/
├── MediaLibraryPage.tsx               # Main media browser
├── MediaDetailPage.tsx                # Individual media view
├── MediaCard.tsx                      # Grid view card
├── PodcastGenerationModal.tsx         # Generation workflow
├── TranscriptEditor.tsx               # Script editing interface
├── MediaPlayer.tsx                    # Audio/video player
└── MediaShareModal.tsx                # Sharing interface
```

## Phase 2: Video Generation Pipeline

### Video Generation Approach
```
Podcast Transcript → Scene Planning → Visual Generation → Video Synthesis
```

### Technical Considerations
- **Scene Breakdown**: Parse transcript into visual scenes
- **Image Generation**: DALL-E/Midjourney API for scene visuals
- **Video Synthesis**: Combine audio track with generated images
- **Transition Effects**: Simple cuts, fades, or motion graphics

### Enhanced Schema for Video
```python
# Additional fields for MediaItem when media_type = "video"
scene_breakdown: JSON              # Timestamped scene descriptions
visual_assets: List[str]          # Generated image file paths
video_config: JSON               # Resolution, effects, transitions
```

## Phase 3: Multi-Modal Extensions

### Visual Content Generation
- **Infographics**: Key concepts → visual layouts
- **Slide Decks**: Structured presentations from documents
- **Interactive Diagrams**: Process flows and concept maps

### Advanced Audio Features
- **Multiple Speakers**: Character voices for different perspectives
- **Background Music**: Ambient audio tracks
- **Sound Effects**: Contextual audio enhancement

### Content Personalization
- **Learning Style Adaptation**: Visual vs. auditory preferences
- **Difficulty Levels**: Beginner/intermediate/advanced versions
- **Language Variants**: Multi-language generation

## Integration Points

### Existing System Leverage
- **Source Document Analysis**: Use existing AI-generated metadata
- **Claude API Integration**: Extend current content generation patterns
- **Sharing System**: Reuse share tokens and QR code infrastructure
- **xAPI Analytics**: Track media consumption alongside activity completion
- **User Permissions**: Follow existing role-based access control

### Content Studio Integration
- **Template System**: Reusable generation templates
- **Batch Processing**: Generate media for multiple sources
- **Approval Workflow**: Review system for generated content

## Analytics & Tracking

### Media Consumption Metrics
- Play/view counts and duration
- Completion rates for longer content
- User engagement patterns
- Popular source documents for media generation

### xAPI Event Tracking
```javascript
// Media play started
{
  "verb": "experienced",
  "object": "podcast",
  "context": {
    "instructor": "AI Generated",
    "duration": "PT8M30S"
  }
}

// Media generation completed
{
  "verb": "created",
  "object": "media-item",
  "result": {
    "completion": true,
    "duration": "PT2M15S"
  }
}
```

## Technical Implementation Plan

### Phase 1 Development (Weeks 1-4)
1. **Week 1**: Database models, API endpoints, ElevenLabs integration
2. **Week 2**: Claude script generation, UI components
3. **Week 3**: Audio generation workflow, media player
4. **Week 4**: Sharing system, xAPI tracking, polish

### Phase 2 Preparation
- Research video generation APIs (RunwayML, Pika Labs)
- Prototype scene breakdown from transcript
- Design video asset pipeline

### Phase 3 Research
- Evaluate multi-modal AI capabilities
- User research on media consumption preferences
- Performance optimization for large media files

## Success Metrics

### MVP Success Criteria
- Users can generate 5+ minute NPR-style podcasts from PDFs
- Generated audio quality meets conversational standards
- Media sharing works across platforms
- Generation time under 3 minutes for 5-minute podcast

### Future Success Indicators
- 80%+ user satisfaction with generated content quality
- Media consumption time rivals activity completion time
- Content creators using media in external contexts
- Reduced time-to-value for document-based learning

## Future Considerations

### Scalability Challenges
- **Storage Costs**: Large audio/video files
- **Generation Costs**: API usage scaling with user base
- **Processing Time**: Longer content = longer wait times

### Quality Assurance
- **Content Accuracy**: Fact-checking generated scripts
- **Audio Quality**: Voice naturalness and consistency
- **User Feedback**: Rating system for generated content

### Platform Evolution
- **API Ecosystem**: Third-party integrations
- **White-Label Options**: Custom branding for enterprises
- **Offline Capabilities**: Downloaded media for offline consumption

---

*This document serves as the master plan for media generation capabilities, designed to extend the existing NLJ platform's content creation ecosystem with AI-powered consumable media assets.*