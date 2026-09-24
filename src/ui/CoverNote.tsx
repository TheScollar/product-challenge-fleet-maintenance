import { useEffect, useRef } from 'react'
import { coverNoteContent, type CoverBlock } from './coverNoteContent'

/**
 * Presentation only: every string on screen comes from coverNoteContent.
 * The switch is exhaustive over CoverBlock['kind'], so adding a new block
 * kind without handling it here is a compile error, not a silently dropped
 * section.
 */
/**
 * The content module preserves the spec's bold spans as inline **...**
 * markers. Odd-indexed segments after splitting on the marker are those
 * spans. This is deliberately the whole grammar: no nesting, no other marks.
 */
function renderEmphasis(text: string) {
  const segments = text.split('**')
  if (segments.length === 1) return text
  return segments.map((segment, index) =>
    index % 2 === 1 ? <strong key={index}>{segment}</strong> : segment,
  )
}

function renderBlockBody(block: CoverBlock) {
  switch (block.kind) {
    case 'prose':
      return (
        <>
          {block.paragraphs.map((paragraph, index) => (
            <p key={index}>{renderEmphasis(paragraph)}</p>
          ))}
        </>
      )
    case 'pairs':
      return (
        <dl className="covernote-pairs">
          {block.pairs.map((pair) => (
            <div className="covernote-pair" key={pair.term}>
              <dt>{pair.term}</dt>
              <dd>{pair.detail}</dd>
            </div>
          ))}
        </dl>
      )
    case 'paths':
      return (
        <>
          <p className="covernote-note">{renderEmphasis(block.note)}</p>
          <ul className="covernote-paths">
            {block.paths.map((entry) => (
              <li key={entry.path}>
                <code>{entry.path}</code>
                <span className="covernote-path-desc">{entry.description}</span>
              </li>
            ))}
          </ul>
        </>
      )
    default: {
      const exhaustive: never = block
      throw new Error(`Unhandled cover note block kind: ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function CoverNote({ onOpenPlan }: { onOpenPlan: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Runs on every mount, including when the cover note is reopened from
  // About, since App.tsx toggles a boolean rather than keeping this
  // component mounted and hidden. [cover note spec 4]
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  return (
    <div className="covernote">
      <main className="covernote-col">
        <h1>{coverNoteContent.title}</h1>
        <p className="promise">{coverNoteContent.promise}</p>

        {coverNoteContent.blocks.map((block) => (
          <section className="covernote-block" key={block.id}>
            <h2>{block.heading}</h2>
            {renderBlockBody(block)}
          </section>
        ))}
      </main>

      <footer className="covernote-bar">
        <button ref={buttonRef} className="covernote-cta" onClick={onOpenPlan}>
          Open the fleet
        </button>
      </footer>
    </div>
  )
}
