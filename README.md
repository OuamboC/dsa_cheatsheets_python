# python-dsa-playground

Interactive cheatsheets and drill exercises for Python data structures, built to support my preparation for software engineering interviews.

**Live Site:** [dsa-cheatsheets-python.vercel.app](https://dsa-cheatsheets-python.vercel.app/)

## Why this exists

I come from a Java background. When I started preparing for technical interviews, I kept getting slowed down by syntax rather than logic. Switching to Python fixed that.

These are the drill exercises I built to master Python data structure operations before going back to LeetCode. The structure and learning goals came from me. I used Claude AI to build the interactive tooling quickly.

## Features

- **65+ interactive exercises** across 5 data structures
- **Sign in with Google or GitHub** to track your progress
- **Daily streaks** to build consistent practice habits
- **Progress sync** across devices when signed in
- **Zero setup** — runs entirely in the browser

## What's covered

| File                              | Structure     | Topics                                                                              |
| --------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `dict_playground.html`            | Dictionary    | Accessing, updating, `.get()`, `.values()`, iteration, `defaultdict`, `Counter`     |
| `list_playground.html`            | List          | Indexing, slicing, `.append()`, `.pop()`, sorting, list comprehensions, `enumerate` |
| `set_playground.html`             | Set           | `.add()`, `.discard()`, union, intersection, difference, O(1) lookup                |
| `tuple_playground.html`           | Tuple         | Unpacking, swapping, tuple as dict key, returning multiple values                   |
| `stack_and_queue_playground.html` | Stack & Queue | LIFO stack with list, FIFO queue with `deque`, BFS pattern                          |

## How to use

1. Visit [the live site](https://dsa-cheatsheets-python.vercel.app/)
2. (Optional) Sign in with Google or GitHub to track progress
3. Pick a data structure and start drilling

Each exercise has:

- A code snippet with a blank to fill in
- A **Check** button to validate your answer
- A **Hint** button if you're stuck
- An explanation of the _why_ when you get it right

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- [Supabase](https://supabase.com) for authentication and data storage
- OAuth with Google and GitHub
- Hosted on [Vercel](https://vercel.com)

---

_Built by [Canis Breal Ouambo](https://github.com/OuamboC) with Claude AI — [anthropic.com](https://www.anthropic.com)_
