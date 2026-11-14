// services/cindromeEngine.js
import {
  KNOWN_DIRECTORS,
  KNOWN_ACTORS,
  NON_DIRECTOR_WORDS,
  NON_ACTOR_WORDS,
  GREETING_AND_CHITCHAT_STOPWORDS,
  REGIONAL_NATIONALITY_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  PRE_MODIFIER_GENRE_MOOD_WORDS,
  CONTROLLER_PRE_MODIFIER_WORDS,
  ENGINE_LEXICON,
  COMMON_TYPOS_MAP,
  MULTI_WORD_ANCHOR_TYPOS,
  GENRE_DESCRIPTOR_STOPWORDS,
  genreMap,
  themeKeywords,
  TMDB_THEME_IDS,
  TMDB_GENRE_IDS,
  TMDB_ID_TO_NAME,
  ECCHI_HAREM_FILTER_REGEX,
  KIDS_MASCOT_FILTER_REGEX,
  MODERN_WARFARE_GUNS_FILTER_REGEX,
  SWORD_WARFARE_THEMES_REGEX,
  EXTREME_VIOLENCE_GORE_FILTER_REGEX,
} from "./engine/constants.js";

import {
  getSimilarityScore,
  normalizeInput,
  getFranchiseKey,
  cleanAnchorQuery,
  isValidAmbiguousSingleWordUsage,
  isValidControllerAmbiguousSingleWord,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  resolveFuzzyActor,
  extractActors,
  normalizePromptSpelling,
  correctTypos,
} from "./engine/textHelper.js";

import { detectContradictions, parseQuery } from "./engine/queryParser.js";
import { scoreAndRank } from "./engine/scoring.js";
import {
  getUserPreviousTexts,
  getSessionSeenIds,
  mergeContext,
  mergeHistoryContext,
} from "./engine/chatContext.js";
import {
  generateResponseText,
  buildPolishedResponseMessage,
  formatRecommendationCards,
  logEngineDiagnostics,
} from "./replyHelper.js";

// Re-export everything so existing imports across the project continue working seamlessly
export {
  KNOWN_DIRECTORS,
  KNOWN_ACTORS,
  NON_DIRECTOR_WORDS,
  NON_ACTOR_WORDS,
  GREETING_AND_CHITCHAT_STOPWORDS,
  REGIONAL_NATIONALITY_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_SINGLE_WORD_TITLES,
  PRE_MODIFIER_GENRE_MOOD_WORDS,
  CONTROLLER_PRE_MODIFIER_WORDS,
  ENGINE_LEXICON,
  COMMON_TYPOS_MAP,
  MULTI_WORD_ANCHOR_TYPOS,
  GENRE_DESCRIPTOR_STOPWORDS,
  genreMap,
  themeKeywords,
  TMDB_THEME_IDS,
  TMDB_GENRE_IDS,
  TMDB_ID_TO_NAME,
  ECCHI_HAREM_FILTER_REGEX,
  KIDS_MASCOT_FILTER_REGEX,
  MODERN_WARFARE_GUNS_FILTER_REGEX,
  SWORD_WARFARE_THEMES_REGEX,
  EXTREME_VIOLENCE_GORE_FILTER_REGEX,
  getSimilarityScore,
  normalizeInput,
  getFranchiseKey,
  cleanAnchorQuery,
  isValidAmbiguousSingleWordUsage,
  isValidControllerAmbiguousSingleWord,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  resolveFuzzyActor,
  extractActors,
  normalizePromptSpelling,
  correctTypos,
  detectContradictions,
  parseQuery,
  scoreAndRank,
  getUserPreviousTexts,
  getSessionSeenIds,
  mergeContext,
  mergeHistoryContext,
  generateResponseText,
  buildPolishedResponseMessage,
  formatRecommendationCards,
  logEngineDiagnostics,
};

export class CindromeEngine {
  static normalizeInput(rawText) {
    return normalizeInput(rawText);
  }

  static extractActors(rawText, extractedDirector = null) {
    return extractActors(rawText, extractedDirector);
  }

  static detectContradictions(params) {
    return detectContradictions(params);
  }

  static parseQuery(text, selectedType = "mixed") {
    return parseQuery(text, selectedType);
  }

  static scoreAndRank(
    candidates,
    parsedIntent,
    userProfileStats = {},
    anchorTitles = null,
    userReviewsCount = 0,
  ) {
    return scoreAndRank(
      candidates,
      parsedIntent,
      userProfileStats,
      anchorTitles,
      userReviewsCount,
    );
  }

  static generateResponseText(
    parsedIntent,
    resultsCount,
    isColdStart = false,
    anchorTitles = null,
  ) {
    return generateResponseText(
      parsedIntent,
      resultsCount,
      isColdStart,
      anchorTitles,
    );
  }
}

export default CindromeEngine;
