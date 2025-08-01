"""
Generation service for Content Studio.
Manages AI content generation sessions with full lineage tracking.
"""

import uuid
import time
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.generation_session import GenerationSession, GenerationStatus
from app.models.source_document import SourceDocument
from app.models.activity_source import ActivitySource
from app.models.content import ContentItem, ContentType
from app.services.claude_service import claude_service
from app.services.source_document_service import SourceDocumentService


class GenerationService:
    """
    Service for managing AI content generation sessions.
    Handles the complete workflow from prompt configuration to activity creation.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.source_service = SourceDocumentService(db)
    
    async def create_generation_session(
        self,
        user_id: uuid.UUID,
        prompt_config: Dict[str, Any],
        source_document_ids: List[uuid.UUID]
    ) -> GenerationSession:
        """
        Create a new generation session.
        
        Args:
            user_id: ID of the user creating the session
            prompt_config: LLM prompt configuration
            source_document_ids: List of source document IDs to use
            
        Returns:
            Created GenerationSession instance
        """
        # Validate source documents exist and belong to user
        source_docs = []
        for doc_id in source_document_ids:
            doc = await self.source_service.get_document_by_id(doc_id, user_id)
            if doc:
                source_docs.append(doc)
        
        if not source_docs:
            raise ValueError("No valid source documents provided")
        
        # Create session
        session = GenerationSession(
            user_id=user_id,
            prompt_config=prompt_config,
            status=GenerationStatus.PENDING
        )
        
        # Add source documents
        session.source_documents = source_docs
        
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        return session
    
    async def start_generation(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """
        Start the generation process for a session.
        
        Args:
            session_id: Generation session ID
            user_id: User ID (for ownership validation)
            
        Returns:
            True if generation started successfully
        """
        print(f"🚀 GenerationService.start_generation called for session {session_id}")
        
        # Get session with source documents
        query = select(GenerationSession).options(
            selectinload(GenerationSession.source_documents)
        ).where(
            and_(
                GenerationSession.id == session_id,
                GenerationSession.user_id == user_id,
                GenerationSession.status == GenerationStatus.PROCESSING  # Changed from PENDING
            )
        )
        
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            print(f"❌ Session {session_id} not found or not in PROCESSING state")
            # Try to find the session anyway to see what state it's in
            debug_query = select(GenerationSession).where(
                and_(
                    GenerationSession.id == session_id,
                    GenerationSession.user_id == user_id
                )
            )
            debug_result = await self.db.execute(debug_query)
            debug_session = debug_result.scalar_one_or_none()
            if debug_session:
                print(f"🔍 Session {session_id} exists but in status: {debug_session.status}")
            else:
                print(f"🔍 Session {session_id} not found at all")
            return False
        
        print(f"✅ Found session {session_id} with {len(session.source_documents)} source documents")
        
        try:
            print(f"📋 Session {session_id} already in processing state, continuing...")
            # Session should already be marked as processing by the API endpoint
            
            print(f"📁 Ensuring {len(session.source_documents)} documents are uploaded to Claude...")
            # Ensure all source documents are uploaded to Claude
            claude_file_ids = []
            for i, source_doc in enumerate(session.source_documents):
                print(f"📄 Processing document {i+1}/{len(session.source_documents)}: {source_doc.original_filename}")
                if await self.source_service.ensure_claude_upload(source_doc):
                    claude_file_ids.append(source_doc.claude_file_id)
                    print(f"✅ Document {source_doc.original_filename} uploaded, Claude file ID: {source_doc.claude_file_id}")
                    # Increment usage count
                    await self.source_service.increment_usage(source_doc.id, user_id)
                else:
                    print(f"❌ Failed to upload document {source_doc.original_filename}")
            
            if not claude_file_ids:
                error_msg = "Failed to upload source documents to Claude"
                print(f"❌ {error_msg}")
                session.fail_with_error(error_msg)
                await self.db.commit()
                return False
            
            print(f"✅ Successfully uploaded {len(claude_file_ids)} documents to Claude")
            
            # Generate prompt text from configuration
            print(f"📝 Building prompt from config...")
            prompt_text = self._build_prompt_from_config(session.prompt_config)
            print(f"📝 Generated prompt ({len(prompt_text)} chars): {prompt_text[:200]}...")
            
            # Call Claude API
            print(f"🤖 Calling Claude API with {len(claude_file_ids)} files...")
            start_time = time.time()
            generated_content, error_message, tokens_used = await claude_service.generate_content(
                prompt_text=prompt_text,
                file_ids=claude_file_ids,
                model=session.prompt_config.get('model', 'claude-3-5-sonnet-20241022'),
                max_tokens=session.prompt_config.get('max_tokens', 8192),
                temperature=session.prompt_config.get('temperature', 0.1)
            )
            generation_time = time.time() - start_time
            print(f"🕰️ Claude API call completed in {generation_time:.2f}s")
            
            if error_message:
                print(f"❌ Claude API returned error: {error_message}")
                session.fail_with_error(error_message)
                await self.db.commit()
                return False
            
            if not generated_content:
                error_msg = "No content generated by Claude"
                print(f"❌ {error_msg}")
                session.fail_with_error(error_msg)
                await self.db.commit()
                return False
            
            content_info = list(generated_content.keys()) if isinstance(generated_content, dict) else type(generated_content)
            print(f"✅ Claude generated content with keys: {content_info}")
            
            # Validate NLJ schema if JSON was generated
            validated_nlj = None
            validation_errors = None
            
            if 'generated_json' in generated_content:
                is_valid, errors = await claude_service.validate_nlj_schema(
                    generated_content['generated_json']
                )
                if is_valid:
                    validated_nlj = generated_content['generated_json']
                    # Ensure required frontend fields are present
                    validated_nlj = self._ensure_required_fields(validated_nlj)
                    print(f"✅ Validated NLJ with required fields: {list(validated_nlj.keys())}")
                else:
                    validation_errors = errors
                    print(f"❌ NLJ validation failed: {errors}")
            
            # Complete the session
            session.complete_successfully(
                generated_content=generated_content,
                validated_nlj=validated_nlj,
                tokens_used=tokens_used,
                generation_time=generation_time
            )
            
            if validation_errors:
                session.validation_errors = validation_errors
            
            await self.db.commit()
            return True
            
        except Exception as e:
            print(f"💥 Generation service error: {str(e)}")
            import traceback
            print(f"Full traceback: {traceback.format_exc()}")
            session.fail_with_error(f"Generation error: {str(e)}")
            await self.db.commit()
            return False
    
    def _build_prompt_from_config(self, config: Dict[str, Any]) -> str:
        """
        Build prompt text from configuration.
        This uses the same logic as the existing LLMPromptGenerator.
        """
        # Build prompt using the configuration data
        # Note: This replicates the logic from the PromptConfiguration component
        # Extract configuration values using correct keys
        audience = config.get('audience_persona', 'General learners')
        objective = config.get('learning_objective', 'Complete the learning activity')
        style = config.get('content_style', 'conversational')
        complexity = config.get('complexity_level', 3)
        length = config.get('scenario_length', 5)
        include_variables = config.get('include_variables', True)
        include_branching = config.get('include_branching', False)
        blooms_levels = config.get('blooms_levels', [])
        node_types = config.get('node_types_enabled', {})
        custom_instructions = config.get('custom_instructions', '')
        
        prompt_parts = [
            "# NLJ Scenario Generation Request",
            "",
            "## Generation Parameters",
            f"- **Target Audience**: {audience}",
            f"- **Learning Objective**: {objective}",
            f"- **Content Style**: {style.replace('_', ' ').title()}",
            f"- **Complexity Level**: {complexity}/5",
            f"- **Scenario Length**: ~{length} nodes",
            f"- **Include Variables**: {('Yes' if include_variables else 'No')}",
            f"- **Include Branching**: {('Yes' if include_branching else 'No')}",
        ]
        
        # Add Bloom's taxonomy levels if specified
        if blooms_levels:
            prompt_parts.append(f"- **Target Bloom's Levels**: {', '.join(blooms_levels)}")
        
        # Add enabled node types
        enabled_types = []
        for category, types in node_types.items():
            if types:
                enabled_types.extend(types)
        
        if enabled_types:
            prompt_parts.extend([
                "",
                "## Enabled Node Types",
                *[f"- {node_type.replace('_', ' ').title()}" for node_type in enabled_types]
            ])
        
        # Add custom instructions if provided
        if custom_instructions:
            prompt_parts.extend([
                "",
                "## Custom Instructions",
                custom_instructions
            ])
        
        prompt_parts.extend([
            "",
            "## Instructions",
            "Please generate a valid NLJ JSON scenario based on the provided source documents.",
            "Follow the NLJ schema requirements and include proper node types, links, and structure.",
            "",
            "### Important Requirements:",
            "- Use HTML formatting instead of markdown for content",
            "- Always include exactly one 'start' node and one 'end' node",
            "- Ensure all links reference existing node IDs",
            "- Node IDs should be unique and descriptive",
            "- Links must have sourceNodeId and targetNodeId fields",
            "- Validate the JSON structure before responding",
            ""
        ])
        
        # Add variables and branching instructions if enabled
        if include_variables or include_branching:
            prompt_parts.extend([
                "### Advanced Features:",
                ""
            ])
            
            if include_variables:
                prompt_parts.extend([
                    "**Variables System:**",
                    "- Include a 'variableDefinitions' array at the scenario level",
                    "- Each variable needs: id, name, type ('number'|'string'|'boolean'), initialValue, description",
                    "- Use variable interpolation with {variableName} syntax in node text/content",
                    "- Add 'variableChanges' arrays to choice nodes to modify variables",
                    "- Variable operations: 'set', 'add', 'subtract', 'multiply', 'divide', 'append', 'toggle'",
                    "- Example variable definition:",
                    "  {\"id\": \"score\", \"name\": \"User Score\", \"type\": \"number\", \"initialValue\": 0, \"description\": \"Tracks user performance\"}",
                    "- Example variable change in choice:",
                    "  \"variableChanges\": [{\"variableId\": \"score\", \"operation\": \"add\", \"value\": 10}]",
                    "- Example interpolation: \"Your current score is {score} points\"",
                    ""
                ])
            
            if include_branching:
                prompt_parts.extend([
                    "**Branching Logic:**",
                    "- Use 'branch' node type for conditional navigation",
                    "- Branch nodes evaluate conditions and route to different paths",
                    "- Include 'conditions' array with expression, targetNodeId, label",
                    "- Add 'defaultTargetNodeId' for fallback routing",
                    "- Expression examples: 'score >= 80', 'experience_level === \"advanced\"', 'confidence_rating <= 2'",
                    "- Mathematical operators: +, -, *, /, %",
                    "- Comparison operators: ===, !==, <, <=, >, >=",
                    "- Logical operators: &&, ||, !",
                    "- Example branch node:",
                    "  {\"type\": \"branch\", \"title\": \"Path Selection\", \"text\": \"Routing based on performance\", \"conditions\": [{\"expression\": \"score >= 80\", \"targetNodeId\": \"advanced_content\", \"label\": \"High Score Path\"}], \"defaultTargetNodeId\": \"basic_content\"}",
                    ""
                ])
        
        prompt_parts.extend([
            "### Response Format:",
            "Return ONLY valid JSON. Do not include explanatory text before or after the JSON:",
            ""
        ])
        
        # Add dynamic schema examples based on enabled node types
        prompt_parts.extend(self._generate_schema_examples(enabled_types, include_variables, include_branching))
        
        prompt_parts.extend([
            "",
            "### Critical Schema Requirements:",
            "- Question nodes have type \"question\", choice nodes have type \"choice\"",
            "- Choice nodes MUST have parentId pointing to their question node",
            "- Each choice MUST have: id, parentId, text, isCorrect (boolean), feedback (string)",
            "- Links connect start->question, and choice->next_node",
            "- Node positioning uses direct x, y, width, height properties",
            "- Text content goes directly in \"text\" property",
            "- Use meaningful node IDs and provide specific feedback for each choice",
            "- Do NOT use embedded choices arrays - use separate choice nodes instead"
        ])
        
        return "\n".join(prompt_parts)
    
    def _generate_schema_examples(self, enabled_types: List[str], include_variables: bool = False, include_branching: bool = False) -> List[str]:
        """Generate dynamic schema examples based on user-selected node types."""
        examples = []
        
        # Always include start and end nodes
        base_nodes = [
            '    {',
            '      "id": "start",',
            '      "type": "start",',
            '      "text": "Welcome to this learning activity.",',
            '      "x": 100, "y": 100, "width": 300, "height": 150',
            '    },'
        ]
        
        # Generate examples for each enabled node type
        node_examples = []
        links = []
        current_y = 300
        node_counter = 1
        previous_node_id = "start"
        
        # Prioritize question types first, then others, and include branch if branching is enabled
        question_types = [t for t in enabled_types if t in ['question', 'true_false', 'ordering', 'matching', 'short_answer']]
        other_types = [t for t in enabled_types if t not in question_types and t not in ['start', 'end', 'interstitial_panel', 'branch']]
        
        # Add branch node if branching is enabled
        types_to_show = question_types + other_types
        if include_branching and 'branch' not in types_to_show:
            types_to_show.append('branch')
        
        types_to_show = types_to_show[:3]  # Limit to 3 examples for brevity
        
        for i, node_type in enumerate(types_to_show):
            node_id = f"node{node_counter}"
            next_node_id = f"node{node_counter + 1}" if i < len(types_to_show) - 1 else "end"
            
            # Add link from previous node to current node (if previous node is not a question with choices)
            if previous_node_id:
                links.append(f'    {{ "id": "{previous_node_id}-to-{node_id}", "sourceNodeId": "{previous_node_id}", "targetNodeId": "{node_id}" }}')
            
            if node_type == 'question':
                # Multiple choice question with choices
                node_examples.extend([
                    '    {',
                    f'      "id": "{node_id}",',
                    '      "type": "question",',
                    '      "text": "' + ('Your current score is {score} points. Sample multiple choice question?' if include_variables else 'Sample multiple choice question?') + '",',
                    f'      "x": 100, "y": {current_y}, "width": 400, "height": 200',
                    '    },',
                    '    {',
                    f'      "id": "{node_id}_choice1",',
                    '      "type": "choice",',
                    f'      "parentId": "{node_id}",',
                    '      "text": "Correct answer",',
                    '      "isCorrect": true,',
                    '      "feedback": "Excellent! That\'s correct.",',
                    '      "variableChanges": ' + ('[{"variableId": "score", "operation": "add", "value": 10}]' if include_variables else '[]') + ',',
                    f'      "x": 100, "y": {current_y + 250}, "width": 300, "height": 100',
                    '    },',
                    '    {',
                    f'      "id": "{node_id}_choice2",',
                    '      "type": "choice",',
                    f'      "parentId": "{node_id}",',
                    '      "text": "Incorrect option",',
                    '      "isCorrect": false,',
                    '      "feedback": "Not quite right. Try again.",',
                    '      "variableChanges": ' + ('[{"variableId": "score", "operation": "subtract", "value": 5}]' if include_variables else '[]') + ',',
                    f'      "x": 450, "y": {current_y + 250}, "width": 300, "height": 100',
                    '    },'
                ])
                # Question links to its choices via parentId, choices link to next node
                links.extend([
                    f'    {{ "id": "{node_id}_choice1-to-{next_node_id}", "sourceNodeId": "{node_id}_choice1", "targetNodeId": "{next_node_id}" }}',
                    f'    {{ "id": "{node_id}_choice2-to-{next_node_id}", "sourceNodeId": "{node_id}_choice2", "targetNodeId": "{next_node_id}" }}'
                ])
                current_y += 400
                previous_node_id = None  # Choices handle the linking, not the question itself
                
            else:
                # All other node types link directly to the next node
                if node_type == 'true_false':
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "true_false",',
                        '      "text": "This statement is true or false?",',
                        '      "correctAnswer": true,',
                        f'      "x": 100, "y": {current_y}, "width": 400, "height": 200',
                        '    },'
                    ])
                    current_y += 250
                
                elif node_type == 'ordering':
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "ordering",',
                        '      "text": "Put these items in the correct order:",',
                        '      "items": [',
                        '        { "id": "item1", "text": "First step", "correctOrder": 1 },',
                        '        { "id": "item2", "text": "Second step", "correctOrder": 2 },',
                        '        { "id": "item3", "text": "Third step", "correctOrder": 3 }',
                        '      ],',
                        f'      "x": 100, "y": {current_y}, "width": 400, "height": 300',
                        '    },'
                    ])
                    current_y += 350
                    
                elif node_type == 'matching':
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "matching",',
                        '      "text": "Match the items on the left with those on the right:",',
                        '      "leftItems": [',
                        '        { "id": "left1", "text": "Item A" },',
                        '        { "id": "left2", "text": "Item B" }',
                        '      ],',
                        '      "rightItems": [',
                        '        { "id": "right1", "text": "Match 1" },',
                        '        { "id": "right2", "text": "Match 2" }',
                        '      ],',
                        '      "correctMatches": [',
                        '        { "leftId": "left1", "rightId": "right1" },',
                        '        { "leftId": "left2", "rightId": "right2" }',
                        '      ],',
                        f'      "x": 100, "y": {current_y}, "width": 500, "height": 300',
                        '    },'
                    ])
                    current_y += 350
                    
                elif node_type == 'short_answer':
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "short_answer",',
                        '      "text": "What is your answer to this question?",',
                        '      "correctAnswers": ["correct answer", "alternative answer"],',
                        '      "caseSensitive": false,',
                        f'      "x": 100, "y": {current_y}, "width": 400, "height": 200',
                        '    },'
                    ])
                    current_y += 250
                    
                elif node_type == 'likert_scale':
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "likert_scale",',
                        '      "text": "How much do you agree with this statement?",',
                        '      "scaleType": "agreement",',
                        '      "scaleSize": 5,',
                        f'      "x": 100, "y": {current_y}, "width": 400, "height": 200',
                        '    },'
                    ])
                    current_y += 250
                    
                elif node_type == 'branch':
                    branch_text = 'Based on your score ({score}), we\'ll direct you to the appropriate path.' if include_variables else 'This branch directs users based on conditions.'
                    condition_expr = 'score >= 80' if include_variables else 'userLevel === "advanced"'
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "branch",',
                        f'      "title": "Conditional Branch",',
                        f'      "text": "{branch_text}",',
                        '      "conditions": [',
                        '        {',
                        f'          "expression": "{condition_expr}",',
                        f'          "targetNodeId": "{next_node_id}",',
                        '          "label": "High Performance Path"',
                        '        }',
                        '      ],',
                        f'      "defaultTargetNodeId": "{next_node_id}",',
                        f'      "x": 100, "y": {current_y}, "width": 400, "height": 200',
                        '    },'
                    ])
                    current_y += 250
                    
                elif node_type == 'interstitial_panel':
                    node_examples.extend([
                        '    {',
                        f'      "id": "{node_id}",',
                        '      "type": "interstitial_panel",',
                        '      "text": "This is informational content between questions.",',
                        f'      "x": 100, "y": {current_y}, "width": 400, "height": 150',
                        '    },'
                    ])
                    current_y += 200
                
                # For non-question nodes, add link to next node and update previous_node_id
                links.append(f'    {{ "id": "{node_id}-to-{next_node_id}", "sourceNodeId": "{node_id}", "targetNodeId": "{next_node_id}" }}')
                previous_node_id = node_id
                
            node_counter += 1
        
        # Add end node
        end_node = [
            '    {',
            '      "id": "end",',
            '      "type": "end",',
            '      "text": "Activity completed successfully!",',
            f'      "x": 100, "y": {current_y}, "width": 300, "height": 150',
            '    }'
        ]
        
        # Links are already properly set to point to the correct next node or end
        
        # Combine everything into a complete JSON example
        examples = [
            "### Schema Example (Based on Your Selected Node Types):",
            "",
            "```json",
            "{",
            '  "id": "generated-activity",',
            '  "name": "Generated Learning Activity",',
            '  "description": "Auto-generated based on selected node types",',
            '  "orientation": "vertical",',
            '  "activityType": "training",'
        ]
        
        # Add variable definitions if variables are enabled
        if include_variables:
            examples.extend([
                '  "variableDefinitions": [',
                '    {',
                '      "id": "score",',
                '      "name": "User Score",',
                '      "type": "number",',
                '      "initialValue": 0,',
                '      "description": "Tracks user performance throughout the activity"',
                '    },',
                '    {',
                '      "id": "userLevel",',
                '      "name": "User Level",',
                '      "type": "string",',
                '      "initialValue": "beginner",',
                '      "description": "User expertise level"',
                '    }',
                '  ],'
            ])
        
        examples.extend([
            '  "nodes": ['
        ])
        
        examples.extend(base_nodes)
        examples.extend(node_examples)
        examples.extend(end_node)
        
        examples.extend([
            '  ],',
            '  "links": ['
        ])
        
        examples.extend([f'    {link},' if i < len(links) - 1 else f'    {link}' for i, link in enumerate(links)])
        
        examples.extend([
            '  ]',
            '}',
            '```'
        ])
        
        return examples
    
    def _ensure_required_fields(self, nlj_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensure the NLJ data has all required fields for the frontend.
        """
        # Make a copy to avoid modifying the original
        result = nlj_data.copy()
        
        # Ensure required top-level fields
        if 'orientation' not in result:
            result['orientation'] = 'vertical'
        
        if 'activityType' not in result:
            # Determine activity type from node types
            node_types = [node.get('type', '') for node in result.get('nodes', [])]
            if any('survey' in nt or 'likert' in nt or 'rating' in nt for nt in node_types):
                result['activityType'] = 'survey'
            elif any('assessment' in nt or 'quiz' in nt for nt in node_types):
                result['activityType'] = 'assessment'
            elif any('game' in nt or 'connections' in nt or 'wordle' in nt for nt in node_types):
                result['activityType'] = 'game'
            else:
                result['activityType'] = 'training'
        
        # Ensure name field exists (required by frontend)
        if 'name' not in result or not result['name']:
            result['name'] = 'Generated Learning Activity'
        
        # Ensure nodes have required positioning data and proper structure
        if 'nodes' in result:
            for i, node in enumerate(result['nodes']):
                if 'x' not in node:
                    node['x'] = 100 + (i % 3) * 300  # Spread nodes horizontally
                if 'y' not in node:
                    node['y'] = 100 + (i // 3) * 200  # Row layout
                if 'width' not in node:
                    node['width'] = 200
                if 'height' not in node:
                    node['height'] = 100
                
                # The new structure uses separate choice nodes, not embedded choices
                # No need to add default choices to question nodes
                    
                    # Ensure node has text property (not in data object)
                    if 'text' not in node:
                        node['text'] = 'Question text not provided.'
                    
                    # Ensure node has title
                    if 'title' not in node:
                        node['title'] = f'Question {i + 1}'
        
        return result
    
    async def get_user_sessions(
        self,
        user_id: uuid.UUID,
        status: Optional[GenerationStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[GenerationSession], int]:
        """Get user's generation sessions with filtering."""
        query = select(GenerationSession).options(
            selectinload(GenerationSession.source_documents)
        ).where(GenerationSession.user_id == user_id)
        
        if status:
            query = query.where(GenerationSession.status == status)
        
        # Get total count
        count_query = query.with_only_columns(GenerationSession.id)
        count_result = await self.db.execute(count_query)
        total_count = len(count_result.fetchall())
        
        # Add pagination and ordering
        query = query.order_by(GenerationSession.created_at.desc())
        query = query.offset(offset).limit(limit)
        
        result = await self.db.execute(query)
        sessions = list(result.scalars().all())
        
        return sessions, total_count
    
    async def get_session_by_id(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Optional[GenerationSession]:
        """Get generation session by ID with ownership validation."""
        query = select(GenerationSession).options(
            selectinload(GenerationSession.source_documents),
            selectinload(GenerationSession.created_activities)
        ).where(
            and_(
                GenerationSession.id == session_id,
                GenerationSession.user_id == user_id
            )
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create_activity_from_session(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        description: Optional[str] = None
    ) -> Optional[ContentItem]:
        """
        Create an activity from a completed generation session.
        
        Args:
            session_id: Generation session ID
            user_id: User ID
            title: Activity title
            description: Optional activity description
            
        Returns:
            Created ContentItem or None if creation failed
        """
        session = await self.get_session_by_id(session_id, user_id)
        
        if not session or not session.has_valid_nlj():
            return None
        
        try:
            # Create the content item
            from app.services.content import ContentService
            from app.schemas.content import ContentCreate
            from app.models.content import ContentType
            
            content_service = ContentService(self.db)
            
            # Determine content type from NLJ data
            content_type = self._determine_content_type(session.validated_nlj)
            
            content_data = ContentCreate(
                title=title,
                description=description,
                content_type=content_type,
                nlj_data=session.validated_nlj
            )
            
            # Create the activity
            activity = await content_service.create_content(content_data, user_id)
            
            # Link to generation session
            activity.generation_session_id = session.id
            
            # Create source lineage records
            for source_doc in session.source_documents:
                lineage = ActivitySource(
                    activity_id=activity.id,
                    source_document_id=source_doc.id,
                    generation_session_id=session.id
                )
                self.db.add(lineage)
            
            await self.db.commit()
            await self.db.refresh(activity)
            
            return activity
            
        except Exception as e:
            print(f"Error creating activity from session: {e}")
            return None
    
    def _determine_content_type(self, nlj_data: Dict[str, Any]) -> ContentType:
        """Determine content type from NLJ data."""
        # Simple heuristic based on node types
        node_types = [node.get('type', '') for node in nlj_data.get('nodes', [])]
        
        if any('game' in nt or 'connections' in nt or 'wordle' in nt for nt in node_types):
            return ContentType.GAME
        elif any('survey' in nt or 'likert' in nt or 'rating' in nt for nt in node_types):
            return ContentType.SURVEY
        elif any('assessment' in nt or 'quiz' in nt for nt in node_types):
            return ContentType.ASSESSMENT
        else:
            return ContentType.TRAINING
    
    async def cancel_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Cancel a pending or processing generation session."""
        session = await self.get_session_by_id(session_id, user_id)
        
        if session and session.status in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]:
            session.cancel()
            await self.db.commit()
            return True
        
        return False
    
    async def retry_failed_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Retry a failed generation session."""
        session = await self.get_session_by_id(session_id, user_id)
        
        if session and session.is_failed():
            # Reset session status
            session.status = GenerationStatus.PENDING
            session.error_message = None
            session.validation_errors = None
            session.started_at = None
            session.completed_at = None
            
            await self.db.commit()
            
            # Start generation again
            return await self.start_generation(session_id, user_id)
        
        return False
    
    async def get_session_statistics(self, user_id: uuid.UUID) -> Dict[str, Any]:
        """Get user's generation session statistics."""
        query = select(GenerationSession).where(GenerationSession.user_id == user_id)
        result = await self.db.execute(query)
        sessions = list(result.scalars().all())
        
        total_sessions = len(sessions)
        completed_sessions = len([s for s in sessions if s.is_completed()])
        failed_sessions = len([s for s in sessions if s.is_failed()])
        
        total_tokens = sum(s.total_tokens_used or 0 for s in sessions if s.total_tokens_used)
        avg_generation_time = None
        
        generation_times = [s.generation_time_seconds for s in sessions if s.generation_time_seconds]
        if generation_times:
            avg_generation_time = sum(generation_times) / len(generation_times)
        
        return {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "failed_sessions": failed_sessions,
            "success_rate": completed_sessions / total_sessions if total_sessions > 0 else 0,
            "total_tokens_used": total_tokens,
            "average_generation_time": avg_generation_time,
            "activities_created": len([s for s in sessions if s.created_activities])
        }