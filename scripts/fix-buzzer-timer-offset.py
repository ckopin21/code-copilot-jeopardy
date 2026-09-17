from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1))


host = Path("src/components/HostAppV3.tsx")
text = host.read_text()
old = """  useEffect(() => {\n    const current = room?.currentQuestion;\n    if (!current) {\n      autoBuzzQuestionRef.current = '';\n      setBuzzerCountdown(null);\n      return;\n    }\n    if (room?.phase !== 'question' || current.dailyDouble || current.responseMode === 'text' || current.answerRevealed || current.buzzOpen || current.buzzWinnerId) {\n      setBuzzerCountdown(null);\n      return;\n    }\n    if (autoBuzzQuestionRef.current === current.questionId) return;\n    autoBuzzQuestionRef.current = current.questionId;\n    let remaining = 10;\n    setBuzzerCountdown(remaining);\n    const interval = window.setInterval(() => {\n      remaining -= 1;\n      setBuzzerCountdown(Math.max(remaining, 0));\n    }, 1000);\n    const timeout = window.setTimeout(() => {\n      window.clearInterval(interval);\n      setBuzzerCountdown(null);\n      audio.cue('open');\n      void perform('host:open-buzzers');\n    }, 10_000);\n    return () => {\n      window.clearInterval(interval);\n      window.clearTimeout(timeout);\n    };\n  }, [room?.currentQuestion, room?.phase, perform]);\n"""
new = """  const autoBuzzQuestion = room?.currentQuestion;\n  const autoBuzzQuestionId = autoBuzzQuestion?.questionId ?? '';\n  const autoBuzzEligible = Boolean(\n    autoBuzzQuestionId &&\n    room?.phase === 'question' &&\n    !autoBuzzQuestion?.dailyDouble &&\n    autoBuzzQuestion?.responseMode !== 'text' &&\n    !autoBuzzQuestion?.answerRevealed &&\n    !autoBuzzQuestion?.buzzOpen &&\n    !autoBuzzQuestion?.buzzWinnerId\n  );\n\n  useEffect(() => {\n    if (!autoBuzzQuestionId) {\n      autoBuzzQuestionRef.current = '';\n      setBuzzerCountdown(null);\n      return;\n    }\n    if (!autoBuzzEligible) {\n      setBuzzerCountdown(null);\n      return;\n    }\n    if (autoBuzzQuestionRef.current === autoBuzzQuestionId) return;\n    autoBuzzQuestionRef.current = autoBuzzQuestionId;\n    let remaining = 10;\n    setBuzzerCountdown(remaining);\n    const interval = window.setInterval(() => {\n      remaining -= 1;\n      setBuzzerCountdown(Math.max(remaining, 0));\n    }, 1000);\n    const timeout = window.setTimeout(() => {\n      window.clearInterval(interval);\n      setBuzzerCountdown(null);\n      audio.cue('open');\n      void perform('host:open-buzzers');\n    }, 10_000);\n    return () => {\n      window.clearInterval(interval);\n      window.clearTimeout(timeout);\n    };\n  }, [autoBuzzEligible, autoBuzzQuestionId, perform]);\n"""
if text.count(old) != 1:
    raise SystemExit(f"HostAppV3.tsx buzzer effect: expected one match, found {text.count(old)}")
host.write_text(text.replace(old, new, 1))

css = Path("src/turn-rules-polish.css")
css_text = css.read_text()
replace_once(
    "src/turn-rules-polish.css",
    ".showcase-player-card.is-turn .turn-beacon {\n  position: absolute;\n  top: -13px;\n  right: 12px;",
    ".showcase-player-card.is-turn .turn-beacon {\n  position: absolute;\n  top: 4px;\n  right: 12px;",
)
replace_once(
    "src/turn-rules-polish.css",
    ".presentation-name-card.is-turn .presentation-turn-beacon {\n  position: absolute;\n  top: -13px;\n  right: 10px;",
    ".presentation-name-card.is-turn .presentation-turn-beacon {\n  position: absolute;\n  top: 4px;\n  right: 10px;",
)
replace_once(
    "src/turn-rules-polish.css",
    "@media (max-width: 760px) {\n  .showcase-player-card.is-turn .turn-beacon {\n    top: -11px;\n    right: 8px;",
    "@media (max-width: 760px) {\n  .showcase-player-card.is-turn .turn-beacon {\n    top: 3px;\n    right: 8px;",
)

# Regression guard: the auto-open effect must be keyed by stable primitives, not the
# whole currentQuestion snapshot object (which is replaced on every room broadcast).
test = Path("tests/buzzerCountdownSource.test.ts")
test.write_text("""import { readFileSync } from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\ndescribe('host buzzer countdown lifecycle', () => {\n  it('keys the auto-open countdown to stable question primitives', () => {\n    const source = readFileSync(new URL('../src/components/HostAppV3.tsx', import.meta.url), 'utf8');\n    expect(source).toContain('[autoBuzzEligible, autoBuzzQuestionId, perform]');\n    expect(source).not.toContain('[room?.currentQuestion, room?.phase, perform]');\n  });\n});\n""")
