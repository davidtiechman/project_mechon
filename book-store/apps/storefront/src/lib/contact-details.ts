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
export function updatePublicContactRows(content: string, accessibility = false): string {
  const details = accessibility ? {
    phone: "0534110171",
    phoneHref: "tel:0534110171",
    email: "d0534110171@gmail.com",
    emailHref: "mailto:d0534110171@gmail.com",
  } : contactDetails
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
            if (accessibility && /^שם רכז(?:ת)? הנגישות\s*:/.test(text))
              return `<strong>שם רכז הנגישות:</strong> דוד`
            const phone = /^(?:טלפון|פלאפון|טלפון נייד)\s*:\s*[+\d\s().-]*$/.test(text)
            const email =
              /^(?:דואר אלקטרוני|דוא[״"׳']?ל|אימייל|מייל)\s*:\s*(?:[\w.+-]+@[\w.-]+)?$/.test(
                text
              )
            if (phone)
              return `<strong>${accessibility ? "פלאפון" : "טלפון"}:</strong> <a href="${details.phoneHref}"><bdi>${details.phone}</bdi></a>`
            if (email)
              return `<strong>דואר אלקטרוני:</strong> <a href="${details.emailHref}"><bdi>${details.email}</bdi></a>`
            return row
          })
          .join("") +
        close
      )
    }
  )
}
