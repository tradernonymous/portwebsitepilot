/**
 * Display type that arrives letter by letter from behind a mask.
 *
 * The effect the whole gallery is named against: a headline is not faded in, it is *built*,
 * each letter rising out of its own clipped slot a beat after the one before. It is the one
 * piece of motion that reads as craft rather than decoration, which is why every site this
 * gallery is measured against opens with it.
 *
 * Two details make it hold up. Words are wrapped in their own nowrap span, so a letter can
 * never be orphaned onto the next line mid-word. And the stagger is capped rather than fixed:
 * a nine-letter word and a forty-letter exhibition title then take about the same time to
 * arrive, so a long title does not sit there assembling itself while the visitor waits.
 *
 * The animation is pure CSS, driven off each character's index, so this component never
 * re-renders and never touches a frame budget.
 */

type Props = {
  text: string;
  className?: string;
  /** Stagger between letters, in ms. Shortened automatically for long strings. */
  stagger?: number;
  /** Hold the whole reveal back, in ms. */
  delay?: number;
  reducedMotion?: boolean;
};

/** Longest a reveal may take, however long the string is. */
const MAX_STAGGER_SPAN = 620;

export function SplitText({ text, className, stagger = 26, delay = 0, reducedMotion = false }: Props) {
  /* Nothing to split for a visitor who has asked for no motion: the text is the text. */
  if (reducedMotion) return <span className={className}>{text}</span>;

  const letters = Array.from(text.replace(/ /g, '')).length;
  const step = letters > 1 ? Math.min(stagger, MAX_STAGGER_SPAN / (letters - 1)) : 0;

  /* Letters are numbered straight through the sentence so the stagger runs across words. */
  let cursor = 0;
  const words = text.split(' ').map((word, index) => {
    const chars = Array.from(word);
    const start = cursor;
    cursor += chars.length;
    return { chars, start, index };
  });

  return (
    <span
      className={`split-text${className ? ` ${className}` : ''}`}
      style={{ ['--split-step' as string]: `${step}ms`, ['--split-delay' as string]: `${delay}ms` }}
      aria-label={text}
    >
      {words.map(({ chars, start, index }) => (
        <span key={index} aria-hidden="true">
          {/* the word's own box stops a letter being orphaned onto the next line */}
          <span className="split-word">
            {chars.map((char, i) => (
              <span className="split-char" key={i} style={{ ['--i' as string]: start + i }}>
                <span>{char}</span>
              </span>
            ))}
          </span>
          {/* the space belongs between the boxes, not inside one */}
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}
