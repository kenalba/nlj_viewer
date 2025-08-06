/**
 * RichTextEditor - Tiptap-based rich text editor with markdown support
 */

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TypographyExtension from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import { convertMarkdownToHtml } from '../../../utils/markdownUtils';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  ClickAwayListener,
  alpha,
} from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatStrikethrough as StrikethroughIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberedListIcon,
  FormatQuote as BlockquoteIcon,
  Code as CodeIcon,
  Title as H1Icon,
  Subject as H2Icon,
  ShortText as H3Icon,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';


interface RichTextEditorProps {
  value: string;
  onUpdate: (value: string) => void;
  placeholder?: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption';
  minHeight?: number;
  maxHeight?: number;
  sx?: object;
  disabled?: boolean;
  showToolbar?: boolean;
  autoFocus?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onUpdate,
  placeholder = 'Click to edit... (Markdown supported)',
  minHeight = 120,
  maxHeight = 400,
  sx = {},
  disabled = false,
  showToolbar = true,
  autoFocus = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure built-in extensions
        bulletList: false, // We'll use our own
        orderedList: false, // We'll use our own
        listItem: false, // We'll use our own
      }),
      TypographyExtension,
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'tiptap-bullet-list',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'tiptap-ordered-list',
        },
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: 'tiptap-list-item',
        },
      }),
    ],
    content: convertMarkdownToHtml(value), // Convert markdown to HTML when loading
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate(html);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        style: `min-height: ${minHeight}px; max-height: ${maxHeight}px; overflow-y: auto;`,
      },
    },
  });

  // Update editor content when value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const htmlContent = convertMarkdownToHtml(value);
      editor.commands.setContent(htmlContent);
    }
  }, [value, editor]);

  // Don't interfere with content updates when in preview mode
  // Preview mode should be read-only and not affect the actual content

  // Update editor editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Focus editor when editing starts
  useEffect(() => {
    if (isEditing && editor && autoFocus) {
      editor.commands.focus();
    }
  }, [isEditing, editor, autoFocus]);

  // Handle starting edit
  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
  };

  // Handle saving edit
  const handleSave = () => {
    setIsEditing(false);
    if (editor) {
      const html = editor.getHTML();
      onUpdate(html);
    }
  };

  // Handle canceling edit
  const handleCancel = () => {
    setIsEditing(false);
    if (editor) {
      editor.commands.setContent(value);
    }
  };

  // Handle click away
  const handleClickAway = () => {
    if (isEditing) {
      handleSave();
    }
  };

  // Toolbar button component
  const ToolbarButton = ({ 
    icon, 
    tooltip, 
    onClick, 
    isActive = false,
    disabled = false 
  }: {
    icon: React.ReactNode;
    tooltip: string;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
  }) => (
    <Tooltip title={tooltip}>
      <IconButton
        size="small"
        onClick={onClick}
        disabled={disabled}
        sx={{
          minWidth: 24,
          width: 24,
          height: 24,
          p: 0.25,
          color: isActive ? 'primary.main' : 'text.secondary',
          backgroundColor: isActive ? alpha('#1976d2', 0.1) : 'transparent',
          '&:hover': {
            backgroundColor: isActive 
              ? alpha('#1976d2', 0.2) 
              : 'action.hover',
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  // Render toolbar
  const renderToolbar = () => {
    if (!editor || !showToolbar) return null;

    return (
      <Stack direction="row" spacing={0.25} sx={{ p: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        {/* Headers */}
        <>
            <ToolbarButton
              icon={<H1Icon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Heading 1"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
            />
            <ToolbarButton
              icon={<H2Icon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Heading 2"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
            />
            <ToolbarButton
              icon={<H3Icon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Heading 3"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

            {/* Text formatting */}
            <ToolbarButton
              icon={<BoldIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
            />
        <ToolbarButton
          icon={<ItalicIcon sx={{ fontSize: '0.875rem' }} />}
          tooltip="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        />
        <ToolbarButton
          icon={<UnderlineIcon sx={{ fontSize: '0.875rem' }} />}
          tooltip="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
        />
            <ToolbarButton
              icon={<StrikethroughIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Strikethrough"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

            {/* Lists */}
            <ToolbarButton
              icon={<BulletListIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Bullet List"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
            />
            <ToolbarButton
              icon={<NumberedListIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Numbered List"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

            {/* Block elements */}
            <ToolbarButton
              icon={<BlockquoteIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Blockquote"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
            />
            <ToolbarButton
              icon={<CodeIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Code Block"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

            {/* Links and media */}
            <ToolbarButton
              icon={<LinkIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Add Link"
              onClick={() => {
                const url = window.prompt('Enter URL:');
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              isActive={editor.isActive('link')}
            />
            <ToolbarButton
              icon={<ImageIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Add Image"
              onClick={() => {
                const url = window.prompt('Enter image URL:');
                if (url) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              }}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

            {/* Undo/Redo */}
            <ToolbarButton
              icon={<UndoIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Undo"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            />
            <ToolbarButton
              icon={<RedoIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Redo"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            />
          </>

        {/* Save/Cancel (only when editing) */}
        {isEditing && (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <ToolbarButton
              icon={<CheckIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Save"
              onClick={handleSave}
            />
            <ToolbarButton
              icon={<CloseIcon sx={{ fontSize: '0.875rem' }} />}
              tooltip="Cancel"
              onClick={handleCancel}
            />
          </>
        )}
      </Stack>
    );
  };

  // Always show the editor with toolbar when showToolbar is true
  return (
    <Box>
      
      <ClickAwayListener onClickAway={handleClickAway}>
        <Paper
          elevation={isEditing ? 2 : 1}
          sx={{
            border: 1,
            borderColor: isEditing ? 'primary.main' : 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            cursor: disabled || isEditing ? 'default' : 'pointer',
            '&:hover': disabled || isEditing ? {} : {
              borderColor: 'primary.main',
            },
            ...sx,
          }}
          onClick={!isEditing && !disabled ? handleStartEdit : undefined}
        >
        {renderToolbar()}
        <Box
          ref={editorRef}
          sx={{
            p: 1,
          }}
        >
          {/* Always show Tiptap editor */}
          <Box
            sx={{
              '& .tiptap-editor': {
                outline: 'none',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                '& p': { margin: '0 0 8px 0' },
                '& ul, & ol': { paddingLeft: '16px', margin: '4px 0' },
                '& blockquote': {
                  borderLeft: '3px solid',
                  borderColor: 'divider',
                  paddingLeft: '12px',
                  marginLeft: 0,
                  fontStyle: 'italic',
                  backgroundColor: 'action.hover',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  margin: '8px 0',
                },
                '& strong': { fontWeight: 'bold' },
                '& em': { fontStyle: 'italic' },
              },
            }}
          >
            <EditorContent editor={editor} />
          </Box>
        </Box>
      </Paper>
    </ClickAwayListener>
  </Box>
  );
};