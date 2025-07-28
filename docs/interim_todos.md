# Current Priority Items (2025-07-28)

## Immediate Priorities (Next 2-3 weeks)

* ✅ **COMPLETED**: Fix the broken Search and Filtering flows on the Activities tab.
* ✅ **COMPLETED**: Improve visual treatment of activities table with Card/Table toggle.
* ✅ **COMPLETED**: Implement approval workflow system with reviewer interface.

## Current User Requirements

* **Content Status Management**: When content is submitted for review, it should show as "Draft" status rather than "Published". Users need clarity on what's awaiting review vs what's live.

* **Bulk Status Operations**: When selecting multiple activities, users should be able to change their status from Published to Draft (and vice versa) in bulk operations.

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

**Platform Status**: 95% complete for core learning delivery
**Next Major Initiative**: LLM Content Generation (pending completion of current priorities)
**Dependencies**: All workflow prerequisites now complete ✅