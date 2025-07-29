# Current Priority Items

## Immediate Priorities (Next 2-3 weeks)

* ✅ **COMPLETED**: Fix the broken search and filtering flows on the Activities page.
* ✅ **COMPLETED**: Improve visual treatment of activities table with Card/Table toggle.
* ✅ **COMPLETED**: Implement approval workflow system with reviewer interface.
* ✅ **COMPLETED**: Enhanced delete functionality with comprehensive workflow state handling.
* ✅ **COMPLETED**: Success alert notifications for content management operations.

## Current User Requirements

* **Content Status Management**: When content is submitted for review, it should show as "Draft" status rather than "Published". Users need clarity on what's awaiting review vs what's live.

* **Bulk Status Operations**: 
  - ✅ **COMPLETED**: Bulk delete operations that handle all workflow states (published, submitted, in_review, etc.)
  - **REMAINING**: General bulk status change operations (Published to Draft, Draft to Published, etc.)

* **Review Interface Enhancements**: When reviewing an activity, reviewers should be able to:
  - "Play" the content to preview it in the Player interface
  - "View" the content to see it in Flow Editor (read-only mode)
  - Navigate seamlessly between review actions and content preview

## Medium-Term Priorities

* **BIG: LLM Content Generation Integration**
    - ✅ **FOUNDATION COMPLETE**: LLM Prompt Generator provides comprehensive prompts for external generation
    - **NEXT PHASE**: Integrate OpenWebUI + LangChain for in-app content generation with RAG capabilities
    - Add document upload for context-aware content generation
    - LLM generation of metadata on learning activities (keywords, topics, etc) for intelligent recommendations
    - Content recommendation system: "look at our content index + learner info and recommend content"

## Technical Debt

* **Flow Editor Node Selection**: Bottom edge is not tied to the actual node bottom, but a static distance from the top edge. This makes selection difficult for taller nodes.

## Status Updates

**Platform Status**: 96% complete for core learning delivery
**Recent Completion**: Enhanced content management with robust delete operations and user feedback
**Next Major Initiative**: LLM Content Generation (pending completion of current priorities)
**Dependencies**: All workflow prerequisites now complete ✅

**Latest Update (2025-07-29)**: 
- Completed comprehensive delete functionality that handles all content states (published, submitted, in_review, draft)
- Added success alert notifications to improve user experience during content operations
- Enhanced error handling with multi-stage fallback deletion process