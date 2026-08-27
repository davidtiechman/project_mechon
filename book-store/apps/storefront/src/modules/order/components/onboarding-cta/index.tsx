"use client"

import { resetOnboardingState } from "@lib/data/onboarding"
import { Button, Container, Text } from "@modules/common/components/ui"

const OnboardingCta = ({ orderId }: { orderId: string }) => {
  return (
    <Container className="max-w-4xl h-full bg-ui-bg-subtle w-full">
      <div className="flex flex-col gap-y-4 center p-4 md:items-center">
        <Text className="text-ui-fg-base text-xl">
        הזמנת הבדיקה נוצרה בהצלחה! 🎉
        </Text>
        <Text className="text-ui-fg-subtle text-small-regular">
        כעת אפשר להשלים את הגדרת החנות בממשק הניהול.
        </Text>
        <Button
          className="w-fit"
          size="large"
          onClick={() => resetOnboardingState(orderId)}
        >
          השלמת ההגדרה בממשק הניהול
        </Button>
      </div>
    </Container>
  )
}

export default OnboardingCta
