import he from "./json/he.json" with { type: "json" }
import { siteContentEn, siteContentHe } from "./content"
import { quickOperationsEn, quickOperationsHe } from "./quick-operations"

/**
 * Completes Medusa's bundled Hebrew resource.
 *
 * Medusa deep-merges Admin extension resources with its built-in dictionaries,
 * so English remains the untouched upstream experience while these Hebrew
 * values fill translated and newly introduced interface keys.
 */
export default {
  he: {
    translation: { ...he, siteContent: siteContentHe, quickOperations: quickOperationsHe },
  },
  en: {
    translation: { siteContent: siteContentEn, quickOperations: quickOperationsEn },
  },
}
