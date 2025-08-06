/**
 * Word validation utility for Wordle games
 * Provides built-in word lists by length and supports custom word lists
 */

// Load word lists from JSON files
import words3Letter from '../data/wordlists/3-letter-words.json';
import words4Letter from '../data/wordlists/4-letter-words.json';
import words5Letter from '../data/wordlists/5-letter-words.json';
import words6Letter from '../data/wordlists/6-letter-words.json';

// Convert JSON format to arrays of uppercase words
const WORDS_3_LETTER = words3Letter.map(item => item.word.toUpperCase());
const WORDS_4_LETTER = words4Letter.map(item => item.word.toUpperCase());
const WORDS_5_LETTER = words5Letter.map(item => item.word.toUpperCase());
const WORDS_6_LETTER = words6Letter.map(item => item.word.toUpperCase());




// Word lists organized by length
const WORD_LISTS: Record<number, string[]> = {
  3: WORDS_3_LETTER,
  4: WORDS_4_LETTER,
  5: WORDS_5_LETTER,
  6: WORDS_6_LETTER,
};

// Domain-specific word lists
const AUTOMOTIVE_WORDS = [
  // Car brands
  'AUDI', 'BMW', 'FORD', 'JEEP', 'KIAS', 'LEXUS', 'MAZDA', 'TESLA', 'VOLVO',
  // Car models (4-6 letters)
  'CAMRY', 'CIVIC', 'COROLLA', 'PRIUS', 'ACCORD', 'SENTRA', 'ALTIMA', 'MAXIMA',
  // Car parts
  'BRAKE', 'CLUTCH', 'ENGINE', 'FILTER', 'PISTON', 'ROTOR', 'SPARK', 'TIRE', 'WHEEL',
  // Car features
  'AIRBAG', 'CRUISE', 'HYBRID', 'TURBO', 'MANUAL', 'STEREO'
];

export interface WordValidationOptions {
  customWords?: string[];
  includeAutomotive?: boolean;
  strictMode?: boolean; // If true, only use provided word lists
}

/**
 * Validates if a word is acceptable for Wordle
 * @param word - The word to validate
 * @param wordLength - Expected length of the word
 * @param options - Additional validation options
 * @returns true if the word is valid, false otherwise
 */
export function isValidWord(word: string, wordLength: number, options: WordValidationOptions = {}): boolean {
  const { customWords = [], includeAutomotive = false, strictMode = false } = options;
  
  // Basic format validation
  if (!word || typeof word !== 'string') {
    return false;
  }
  
  const upperWord = word.toUpperCase().trim();
  
  // Check length
  if (upperWord.length !== wordLength) {
    return false;
  }
  
  // Check if it's only letters
  if (!/^[A-Z]+$/.test(upperWord)) {
    return false;
  }
  
  // Check custom words first (highest priority)
  if (customWords.length > 0 && customWords.includes(upperWord)) {
    return true;
  }
  
  // If strict mode, only use custom words
  if (strictMode) {
    return false;
  }
  
  // Check built-in word list for this length
  const builtInWords = WORD_LISTS[wordLength] || [];
  if (builtInWords.includes(upperWord)) {
    return true;
  }
  
  // Check automotive words if enabled
  if (includeAutomotive && AUTOMOTIVE_WORDS.includes(upperWord)) {
    return true;
  }
  
  return false;
}

/**
 * Get all valid words for a given length
 * @param wordLength - The length of words to return
 * @param options - Additional options
 * @returns Array of valid words
 */
export function getValidWords(wordLength: number, options: WordValidationOptions = {}): string[] {
  const { customWords = [], includeAutomotive = false } = options;
  
  const words = new Set<string>();
  
  // Add custom words
  customWords.forEach(word => {
    const upperWord = word.toUpperCase().trim();
    if (upperWord.length === wordLength && /^[A-Z]+$/.test(upperWord)) {
      words.add(upperWord);
    }
  });
  
  // Add built-in words
  const builtInWords = WORD_LISTS[wordLength] || [];
  builtInWords.forEach(word => words.add(word));
  
  // Add automotive words if enabled
  if (includeAutomotive) {
    AUTOMOTIVE_WORDS.forEach(word => {
      if (word.length === wordLength) {
        words.add(word);
      }
    });
  }
  
  return Array.from(words).sort();
}

/**
 * Get a random valid word for a given length
 * @param wordLength - The length of word to return
 * @param options - Additional options
 * @returns A random valid word
 */
export function getRandomWord(wordLength: number, options: WordValidationOptions = {}): string {
  const validWords = getValidWords(wordLength, options);
  if (validWords.length === 0) {
    throw new Error(`No valid words found for length ${wordLength}`);
  }
  return validWords[Math.floor(Math.random() * validWords.length)];
}

/**
 * Check if word lists are available for a given length
 * @param wordLength - The length to check
 * @returns true if word lists are available
 */
export function hasWordList(wordLength: number): boolean {
  return wordLength in WORD_LISTS && WORD_LISTS[wordLength].length > 0;
}

/**
 * Get available word lengths
 * @returns Array of supported word lengths
 */
export function getAvailableWordLengths(): number[] {
  return Object.keys(WORD_LISTS).map(Number).sort((a, b) => a - b);
}