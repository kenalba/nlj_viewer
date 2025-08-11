/**
 * Inline Email Management Component
 * Allows users to paste and manage email lists directly without modals
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  Chip,
  Stack,
  Button,
  Alert,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ContentPaste as PasteIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Email as EmailIcon,
} from '@mui/icons-material';

interface EmailValidation {
  email: string;
  isValid: boolean;
  error?: string;
}

interface InlineEmailManagerProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
}

// Email validation regex (basic but practical)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parse emails from pasted text
const parseEmailsFromText = (text: string): string[] => {
  const emails: string[] = [];
  
  // Split on common delimiters: comma, semicolon, newline, space, tab
  const parts = text.split(/[,;\n\r\s\t]+/);
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed) {
      // Extract email from formats like "Name <email@domain.com>" or just "email@domain.com"
      const emailMatch = trimmed.match(/<?([^\s<>]+@[^\s<>]+\.[^\s<>]+)>?/);
      if (emailMatch) {
        emails.push(emailMatch[1].toLowerCase());
      } else if (trimmed.includes('@')) {
        // Fallback: if it contains @, treat as potential email
        emails.push(trimmed.toLowerCase());
      }
    }
  });
  
  return emails;
};

// Validate email format
const validateEmail = (email: string): EmailValidation => {
  if (!email.trim()) {
    return { email, isValid: false, error: 'Email cannot be empty' };
  }
  
  const isValid = EMAIL_REGEX.test(email);
  return {
    email: email.toLowerCase(),
    isValid,
    error: isValid ? undefined : 'Invalid email format',
  };
};

// Remove duplicates while preserving order
const removeDuplicates = (emails: string[]): string[] => {
  const seen = new Set<string>();
  return emails.filter(email => {
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};

export const InlineEmailManager: React.FC<InlineEmailManagerProps> = ({
  emails,
  onChange,
  placeholder = "Paste email addresses here (comma, space, or newline separated)...",
  helperText = "You can paste multiple emails separated by commas, spaces, or new lines",
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [showInvalid, setShowInvalid] = useState(true);

  // Process and validate emails
  const emailValidations = useMemo(() => {
    return emails.map(validateEmail);
  }, [emails]);

  const validEmails = emailValidations.filter(v => v.isValid);
  const invalidEmails = emailValidations.filter(v => !v.isValid);
  const duplicateCount = emails.length - removeDuplicates(emails).length;

  // Handle text input changes
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
  }, []);

  // Handle paste and auto-process
  const handleInputKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (inputText.trim()) {
        const newEmails = parseEmailsFromText(inputText);
        const combinedEmails = removeDuplicates([...emails, ...newEmails]);
        onChange(combinedEmails);
        setInputText('');
      }
    }
  }, [inputText, emails, onChange]);

  // Handle paste event
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const pastedText = event.clipboardData.getData('text');
    if (pastedText) {
      event.preventDefault();
      const newEmails = parseEmailsFromText(pastedText);
      const combinedEmails = removeDuplicates([...emails, ...newEmails]);
      onChange(combinedEmails);
      setInputText('');
    }
  }, [emails, onChange]);

  // Remove specific email
  const handleRemoveEmail = useCallback((emailToRemove: string) => {
    const updatedEmails = emails.filter(email => email !== emailToRemove);
    onChange(updatedEmails);
  }, [emails, onChange]);

  // Clear all emails
  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Remove only invalid emails
  const handleRemoveInvalid = useCallback(() => {
    const validEmailAddresses = validEmails.map(v => v.email);
    onChange(validEmailAddresses);
  }, [validEmails, onChange]);

  // Remove duplicates
  const handleRemoveDuplicates = useCallback(() => {
    const uniqueEmails = removeDuplicates(emails);
    onChange(uniqueEmails);
  }, [emails, onChange]);

  return (
    <Box>
      {/* Input Field */}
      <TextField
        fullWidth
        multiline
        minRows={2}
        maxRows={4}
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        helperText={helperText}
        disabled={disabled}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <EmailIcon sx={{ color: 'text.secondary', mr: 1, alignSelf: 'flex-start', mt: 1 }} />
          ),
        }}
      />

      {/* Action Buttons */}
      {emails.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearAll}
            disabled={disabled}
          >
            Clear All ({emails.length})
          </Button>
          
          {invalidEmails.length > 0 && (
            <Button
              size="small"
              startIcon={<FilterIcon />}
              onClick={handleRemoveInvalid}
              color="warning"
              disabled={disabled}
            >
              Remove Invalid ({invalidEmails.length})
            </Button>
          )}
          
          {duplicateCount > 0 && (
            <Button
              size="small"
              startIcon={<FilterIcon />}
              onClick={handleRemoveDuplicates}
              color="info"
              disabled={disabled}
            >
              Remove Duplicates ({duplicateCount})
            </Button>
          )}

          <Tooltip title={showInvalid ? "Hide invalid emails" : "Show invalid emails"}>
            <IconButton
              size="small"
              onClick={() => setShowInvalid(!showInvalid)}
            >
              <FilterIcon color={showInvalid ? "primary" : "disabled"} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Email Summary */}
      {emails.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <PersonIcon sx={{ color: 'text.secondary' }} />
            <Typography variant="subtitle2">
              Recipients: {validEmails.length} valid
              {invalidEmails.length > 0 && `, ${invalidEmails.length} invalid`}
              {duplicateCount > 0 && `, ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''}`}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Valid Emails */}
      {validEmails.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'success.main' }}>
            Valid Recipients ({validEmails.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {validEmails.map((validation, index) => (
              <Chip
                key={`valid-${index}`}
                label={validation.email}
                onDelete={disabled ? undefined : () => handleRemoveEmail(validation.email)}
                color="success"
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Invalid Emails */}
      {invalidEmails.length > 0 && showInvalid && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'error.main' }}>
            Invalid Recipients ({invalidEmails.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {invalidEmails.map((validation, index) => (
              <Tooltip key={`invalid-${index}`} title={validation.error}>
                <Chip
                  label={validation.email}
                  onDelete={disabled ? undefined : () => handleRemoveEmail(validation.email)}
                  color="error"
                  variant="outlined"
                  size="small"
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {/* Help Text for Empty State */}
      {emails.length === 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Typography variant="body2">
            <strong>Tip:</strong> You can paste multiple email addresses from Excel, your contacts, 
            or any text source. The system will automatically detect and validate email addresses 
            regardless of formatting.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};