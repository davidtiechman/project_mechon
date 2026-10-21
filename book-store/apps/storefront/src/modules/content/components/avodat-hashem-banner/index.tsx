import Image from "next/image"
import type { CSSProperties } from "react"
import styles from "./banner.module.css"

// Original embedded SVGs, in the supplied artwork's left-to-right order.
const widths = [
  252.27906976744185, 288.1829067340437, 227.87720274069912,
  217.44695617939715, 206.6967252888957, 312.85609644747296,
  257.53069322399006, 268.34150079386, 286.94156904779857,
  205.54048707072516,
]
const titles = widths.map((width, index) => ({ width, number: index + 1 }))

export default function AvodatHashemEntrance() {
  return (
    <div className={styles.entrance} aria-hidden="true" dir="ltr">
      {titles.map(({ width, number }, index) => (
        <div
          className={styles.item}
          key={number}
          style={{ "--delay": `${index * 2}s`, "--weight": width } as CSSProperties}
        >
          <Image
            src={`/avodat-hashem/title-${String(number).padStart(2, "0")}.svg`}
            alt=""
            width={Math.round(width * 1000)}
            height={240000}
            sizes="10vw"
            className={styles.image}
            loading="eager"
            draggable={false}
            unoptimized
          />
        </div>
      ))}
    </div>
  )
}
