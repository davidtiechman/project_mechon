import { Button, Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="bg-white flex flex-col items-start justify-between gap-4 xsmall:flex-row xsmall:items-center xsmall:gap-6">
      <div className="text-right">
        <Heading level="h2" className="txt-xlarge">
          כבר יש לך חשבון?
        </Heading>
        <Text className="txt-medium text-ui-fg-subtle mt-2">
          התחבר כדי ליהנות מחוויית קנייה טובה יותר.
        </Text>
      </div>
      <div className="shrink-0">
        <LocalizedClientLink href="/account">
          <Button variant="secondary" className="h-10" data-testid="sign-in-button">
            התחברות
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
