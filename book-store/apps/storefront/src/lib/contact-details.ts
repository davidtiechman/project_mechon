// Public business contact details shared by visitor-facing pages.
export const contactDetails = {
  phone: "02-5386591",
  phoneHref: "tel:025386591",
  email: "5386591@gmail.com",
  emailHref: "mailto:5386591@gmail.com",
  fax: "02-5386379",
} as const

// CMS legal pages may contain an empty contact row or an older business value.
// Only replace dedicated contact paragraphs, never contact details in prose.
export function updatePublicContactRows(content: string): string {
  return content.replace(
    /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi,
    (_paragraph, open, body: string, close) => {
      const rows = body.split(/(<br\s*\/?\s*>)/gi)
      return (
        open +
        rows
          .map((row) => {
            const text = row
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim()
            const phone = /^טלפון\s*:\s*[+\d\s().-]*$/.test(text)
            const email =
              /^(?:דואר אלקטרוני|דוא[״"׳']?ל|אימייל|מייל)\s*:\s*(?:[\w.+-]+@[\w.-]+)?$/.test(
                text
              )
            if (phone)
              return `<strong>טלפון:</strong> <a href="${contactDetails.phoneHref}"><bdi>${contactDetails.phone}</bdi></a>`
            if (email)
              return `<strong>דואר אלקטרוני:</strong> <a href="${contactDetails.emailHref}"><bdi>${contactDetails.email}</bdi></a>`
            return row
          })
          .join("") +
        close
      )
    }
  )
}
