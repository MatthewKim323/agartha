# agartha — landing page brief

Everything needed to build the page. Written for whoever is doing the site, not
for the judges. Read the "never say" section before writing a single headline.

---

## 1. What it is, in one paragraph

agartha is an AI companion that has known matt for two months — 9,995 pages of
real conversation history — and can now play Minecraft with him. You talk to it
out loud, it answers in about a second, and while it's still talking its hands
are already moving in the world. It remembers who you are between sessions,
because it shares a brain with an agent that has been living in his Discord
since May.

## 2. The thesis (this is the whole pitch)

**AI companions can talk. They can't do anything with you.**

That's the gap. Character.AI has 233 million registered users. Replika has 25
to 40 million. Xiaoice has 660 million. People are clearly desperate for
company. But every one of those products is a text box. The relationship is
entirely conversational — it can listen to you talk about your day, and that's
where it ends.

agartha is a companion that shows up **in the world with you**. It doesn't ask
how your day was, it says "on it" and goes and chops the tree.

### The sharpest version of the argument

There's a real research split on whether AI companions help:

- Harvard Business School found companions reduced loneliness roughly as much
  as talking to another person.
- MIT Media Lab and OpenAI found heavier daily chatbot use correlated with
  *higher* loneliness and emotional dependence.

Both can be true, and the difference is the interesting part: **passive
conversation may deepen isolation. Shared activity is how humans actually bond.**
Nobody becomes friends by being asked how their day went every evening. They
become friends by doing things together.

That is the argument for embodiment, and it's why this is a companion product
and not a game bot.

## 3. Numbers you may cite (verified)

| claim | source |
|---|---|
| Character.AI: 233M registered users, ~20M monthly active | industry stats, Apr 2026 |
| Replika: 25-40M registered users | industry stats 2026 |
| Xiaoice: 660M users | industry stats 2026 |
| Consumer AI companion apps: $82M revenue H1 2025, $120M by year end | industry stats |
| US Surgeon General declared loneliness an epidemic (2023) | official advisory |
| Social disconnection raises mortality risk ~29%, comparable to 15 cigarettes/day | Surgeon General advisory |
| HBS: companions reduced loneliness about as much as talking to a person | HBS study |
| MIT Media Lab + OpenAI: heavier use linked to higher loneliness | MIT/OpenAI study |

**Do NOT cite a market size number.** Sources ranged from $49B to $366B for
2026, which means they are measuring completely different things. A judge who
knows the space will clock a made-up TAM instantly and you lose credibility on
everything else. Use user counts and revenue — those are consistent.

## 4. Our own numbers (all measured, all defensible)

These are real, taken from a live server and a live API. They're in
`docs/MEASUREMENTS.md` with methodology.

| | before | agartha |
|---|---|---|
| voice → action dispatch | ~10s (spawned a CLI agent per reaction) | **1-15ms** (median 3) |
| memory retrieval | 1.3-4.0s | **13-69ms** (0ms cached) |
| reflex loop | — | **15Hz**, 67ms/tick, no LLM |
| time to first audio | 6.5-13s | **~1.6s** |

Verified in-world, not just at the API boundary:

```
"yo what's good bro, can you go chop down that tree for me"
  → "yo everything's good here. on it, lemme go chop that tree for you."
  → inventory: oak_log x3 → oak_log x6, birch_log x4
```

And memory, live:

```
"what am I building at kali labs again"
  → recall() @ 345ms
  → "you mentioned building jabby and the kali platform, which seems like
     a lot at once btw. is there one in particular?"
```

Note it pushed back unprompted. That's a house rule inherited from its
personality file, not a scripted line.

## 5. Headline options

Strongest first.

1. **"Your AI friend can finally do something with you."**
   Sub: 233 million people talk to AI companions. None of them can hand you a
   pickaxe.

2. **"It's been my friend for two months. Last night it got hands."**
   Sub: A companion with real memory, now embodied in a world you can play in.

3. **"Loneliness isn't solved by something that only talks."**
   Sub: An AI companion that shows up and does things with you, in about a
   second.

Avoid anything that leads with "Minecraft AI bot." Minecraft is the *proof*,
not the product. Lead with the companion, show the game.

## 6. Page structure

1. **Hero** — headline, one line of sub, and the demo video. The video is the
   product; everything else is support.
2. **The gap** — companion apps are text boxes. Big user numbers, then the
   turn: none of them can *do* anything.
3. **What it does** — three beats, each with the real latency:
   - hears you and answers (~1.6s)
   - acts while still talking (3ms dispatch)
   - remembers you across months (345ms recall, real example)
4. **How it works** — the three-lane diagram. Keep it visual, one sentence per
   lane. The point is "nothing slow is allowed in front of speech."
5. **Receipts** — the measurement table. This is the credibility section; most
   projects have nothing like it.
6. **What's next** — same architecture works for any real-time environment.
   Minecraft is where we proved it.

## 7. Voice and tone

Lowercase, direct, unhyped. The product is warm; the copy should be plain. Let
the numbers do the bragging.

**Never use:** "revolutionary", "game-changing", "the future of", "harness the
power of", "seamlessly". If a sentence would fit on any other AI landing page,
delete it.

Good: *"it answers in about a second and it's already moving."*
Bad: *"leveraging cutting-edge real-time AI to revolutionize companionship."*

## 8. Claims we can defend, and claims we cannot

**Defensible — every one of these was measured:**
- tool dispatch 1-15ms, median 3ms
- memory recall 13-69ms warm, 0ms cached
- 15Hz reflex loop that never touches an LLM
- it chopped a real tree on a real server, inventory verified
- it recalled a real fact about matt from two months of history
- shares one identity with an agent that has been running since May

**Do NOT claim:**
- "sub-second voice." It's ~1.6s to first audio. Say "about a second" or give
  the real number. Do not round in our favour.
- any market size figure (see above)
- "AGI." Say what it does. The audience will draw their own conclusion, and
  they'll respect it more.
- that it cures loneliness. Cite the research split honestly — it's a stronger
  argument than overclaiming, and the MIT finding is *our* argument.
- anything about therapy, mental health treatment, or replacing human contact.

**Privacy line, important:** the memory contains matt's real private history —
tens of thousands of personal messages. **Never show real memory contents on
the site or in the video.** Demo memory using project facts only (Kali, jabby,
the build). This is non-negotiable, not a style note.

## 9. Objections a judge will raise

**"Isn't this just a Minecraft bot?"**
The Minecraft part took one night. The part that matters is that an agent with
two months of accumulated memory transferred into a new environment without
losing its identity. That's generality, and Minecraft is where we could show it.

**"Why not use a managed agent runtime?"**
We evaluated it. Routing the hot path through a managed cloud runtime would have
added network hops to the exact thing this project exists to remove. We have the
measurement. Being fast was the point.

**"Is the latency real?"**
Yes, and here's how it was measured — `docs/MEASUREMENTS.md` includes a section
listing what we have *not* verified. Ask about any number in it.

## 10. Assets

- Demo video: hero, autoplay muted, loop.
- Live world view (prismarine-viewer) screenshot: shows the bot acting.
- Terminal capture of a real turn: `heard: … / said: … / tool set_goal → …`.
  This is surprisingly compelling — it makes the speed legible.
- Architecture diagram: three lanes, from `docs/ARCHITECTURE.md`.

Repo: github.com/MatthewKim323/agartha
