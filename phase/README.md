# Phase card feed

The Phase Android theme reads two files from here whenever the phone is online:

- `cards.txt`: your own cards, in the plain format described at the top of the file. Edit and commit; phones pick it up within a few hours.
- `library.json`: a public-domain library (Westminster Larger Catechism, Westminster Confession, French Confession) built by `tools/build_library.py` in the phase-android repo. Regenerate it there to add more.

New cards show first on the phone, then join the rotation with the 500 inside the app. Nothing is shown to the user about the update itself.
