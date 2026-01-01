import type { TrieNode } from './types';
import { BOGGLE_WORDS } from './wordlist';

/**
 * Trie data structure for efficient word lookup and prefix checking.
 * O(1) lookup for word validity and O(k) for prefix checking where k is prefix length.
 */
let root: TrieNode | null = null;
let wordSet: Set<string> | null = null;
let isLoaded = false;

function createNode(): TrieNode {
  return {
    children: new Map(),
    isWord: false,
  };
}

function insertWord(word: string): void {
  if (!root) return;

  let node = root;
  for (const char of word.toUpperCase()) {
    if (!node.children.has(char)) {
      node.children.set(char, createNode());
    }
    node = node.children.get(char)!;
  }
  node.isWord = true;
}

/**
 * Load the dictionary. Call this before using other dictionary functions.
 * This is synchronous but designed to be called once at game start.
 */
export function loadDictionary(): void {
  if (isLoaded) return;

  root = createNode();
  wordSet = new Set();

  for (const word of BOGGLE_WORDS) {
    const upper = word.toUpperCase();
    insertWord(upper);
    wordSet.add(upper);
  }

  isLoaded = true;
}

/**
 * Check if a word is in the dictionary.
 */
export function isWord(word: string): boolean {
  if (!wordSet) {
    loadDictionary();
  }
  return wordSet!.has(word.toUpperCase());
}

/**
 * Check if a prefix exists in the dictionary.
 * Used by the solver to prune search paths early.
 */
export function isPrefix(prefix: string): boolean {
  if (!root) {
    loadDictionary();
  }

  let node = root!;
  for (const char of prefix.toUpperCase()) {
    if (!node.children.has(char)) {
      return false;
    }
    node = node.children.get(char)!;
  }
  return true;
}

/**
 * Get the trie root for advanced operations.
 */
export function getTrieRoot(): TrieNode {
  if (!root) {
    loadDictionary();
  }
  return root!;
}

/**
 * Check if dictionary is loaded.
 */
export function isDictionaryLoaded(): boolean {
  return isLoaded;
}
