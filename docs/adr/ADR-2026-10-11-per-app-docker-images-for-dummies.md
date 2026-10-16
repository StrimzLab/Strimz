# ADR for Dummies: Make the per-service Docker images actually start

- **Status:** Accepted (2026-10-11, D1–D5 as recommended)
- **Date:** 2026-10-11

## The Idea

Besides the one big container that runs on Lightsail, each backend service (the API,
the scheduler, the agent) has its own small Docker image. Those are the way to run
Strimz on proper hosting later, and our automated checks build them on every related
change.

We built all three today and tried to start them. None starts:

- the API image is missing the libraries it needs, because of how our package manager
  links them;
- the scheduler and agent images look for their program in the wrong folder.

The automated check only builds the images and never starts them, so nobody noticed.
The local "everything in containers" setup is broken too: the indexer rejects its
database address, the services run in production mode, which now demands AWS keys and
bot protection a laptop doesn't have, and the local blockchain uses a different network
number from the one our code expects.

We fix it like this:

1. The images ship a proper, trimmed copy of the libraries.
2. All three services put their program in the same place, and the Lightsail container
   is updated to match.
3. The automated check starts every image, including the Lightsail one, and fails if the
   program does not load.
4. The local stack runs in development mode, with the local blockchain on the testnet
   network number and the indexer given a database address it accepts.
5. The scheduler's example settings file lists the two settings it is missing.

## What the Person Sees

- Merchants and payers: nothing.
- The maintainer: the next Lightsail redeploy uses the new program paths, with nothing
  to change in its settings. The local "full" stack starts.

## Important Limitation

The local stack no longer runs in production mode, so it no longer tests production
safety checks; unit tests and the real deploy cover those. The automated Docker check
takes longer, but it only runs when Docker files change.

## Choices for the maintainer

- **D1.** Ship a trimmed copy of the libraries in each image. Recommended.
- **D2.** Same program location for every service, Lightsail updated at the same time.
  Recommended.
- **D3.** Start-up check for the three images and the Lightsail one. Recommended.
- **D4.** Local stack in development mode, local blockchain on the testnet network
  number. Recommended.
- **D5.** Add the two missing scheduler settings to its example file. Recommended.
