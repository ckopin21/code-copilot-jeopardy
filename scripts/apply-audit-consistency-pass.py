from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/components/HostAppV3.tsx",
    "  const connectedPlayers = room.players.filter((player) => player.connected);\n  const reservedSeatCount = room.players.length - connectedPlayers.length;",
    "  const connectedPlayers = room.players.filter((player) => player.connected);\n  const activeQuestionPlayers = current?.participantIds\n    ? connectedPlayers.filter((player) => current.participantIds!.includes(player.id))\n    : connectedPlayers;\n  const reservedSeatCount = room.players.length - connectedPlayers.length;",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "  const textResponseCount = connectedPlayers.filter((player) => Boolean(textResponses[player.id])).length;",
    "  const textResponseCount = activeQuestionPlayers.filter((player) => Boolean(textResponses[player.id])).length;",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "<div className=\"response-progress\"><strong>{textResponseCount}/{connectedPlayers.length}</strong><span>responses locked in</span><small>The answer reveals automatically when every connected player submits or the timer expires.</small></div>",
    "<div className=\"response-progress\"><strong>{textResponseCount}/{activeQuestionPlayers.length}</strong><span>responses locked in</span><small>The answer reveals automatically when every active player submits or the timer expires.</small></div>",
)
replace_once(
    "src/components/HostAppV3.tsx",
    "    audio.cue('wrong');\n  }, [room]);",
    "    recordAttempt(ownerId, false);\n    audio.cue('wrong');\n  }, [room, recordAttempt]);",
)

replace_once(
    "src/components/PresentationApp.tsx",
    "  const responseCount = Object.keys(current?.textResponses ?? {}).length;\n  const connectedPlayers = room.players.filter((player) => player.connected);",
    "  const connectedPlayers = room.players.filter((player) => player.connected);\n  const activeQuestionPlayers = current?.participantIds\n    ? connectedPlayers.filter((player) => current.participantIds!.includes(player.id))\n    : connectedPlayers;\n  const responseCount = activeQuestionPlayers.filter((player) => Boolean(current?.textResponses?.[player.id])).length;",
)
replace_once(
    "src/components/PresentationApp.tsx",
    "<div className=\"presentation-response-count\"><strong>{responseCount}/{connectedPlayers.length}</strong><span>RESPONSES IN</span></div>",
    "<div className=\"presentation-response-count\"><strong>{responseCount}/{activeQuestionPlayers.length}</strong><span>RESPONSES IN</span></div>",
)

replace_once(
    "src/components/PlayerApp.tsx",
    "<small>Waiting for the other connected players.</small>",
    "<small>Waiting for the other active players.</small>",
)
