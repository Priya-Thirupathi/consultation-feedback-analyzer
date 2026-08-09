# Demo script

Three minutes, timed. Cut list and Q&A at the bottom.

Do not script around theme names. The wording of the themes changes between
runs, so every line here refers to positions and counts, never to a specific
theme. If you memorise a theme name you will be corrected by your own screen.

## The one sentence

Upload the written responses to a public consultation and see what was actually
argued, ranked by how many organisations argued it — and check every count
against the rows it came from.

## Before you stand up

- [ ] Two browser tabs. Tab 1 on the app, empty. Tab 2 already showing a
      finished run of `data/trai_comments.csv`, all 223 rows, 19 organisations.
      Run it before the session starts. It takes about two minutes, which is
      why it is not run live.
- [ ] `data/trai_sample.csv` on the desktop, easy to find in the file picker.
- [ ] If demoing the deployed URL, load it once first. The free instance sleeps
      and the first request after that costs about a minute.
- [ ] Phone hotspot ready. Venue wifi plus a paced API is the classic failure.
- [ ] Check no old server is on port 3000: `ps -eo pid,cmd | grep src/index`.
- [ ] Decide what is in Reports before you present. Finished runs are kept in the
      browser and the app reopens the most recent one on load, so tab 1 will not
      be empty if you ran something earlier. Either delete the stale ones from
      the Reports view, or keep the full 223 row run there deliberately and open
      the demo from it.

Fallback order if the live run fails: tab 2, then a screenshot. Say "I have a
finished run here" and keep moving. Do not debug on stage.

## Script

**0:00 to 0:25, the problem**

When a city publishes a draft master plan, the public gets about a month to file
written objections. Someone has to read all of them before the hearings.

Coimbatore's Master Plan 2041 drew over three thousand. Pimpri Chinchwad, forty
nine thousand on a single plan.

Today that is one analyst, a spreadsheet, and two months.

**0:25 to 0:35, start the run talking**

Pick `trai_sample.csv`, click Analyze, keep talking. Do not watch the screen.

This is real data. Written responses to a TRAI consultation, forty of them.

**0:35 to 0:55, cover the wait**

Every response goes to Gemini and comes back with the one thing it argues.
Requests are paced to stay inside the free tier, so this takes about twenty
seconds. The timer is on screen on purpose. A button that goes quiet that long
reads as a crash.

**0:55 to 1:15, the tiles**

Read the four tiles left to right. Responses read, carried a position,
organisations, themes found.

Point at "carried a position" and the number set aside.

Some of these are not arguments. They are headers, or a restatement of the
question. Those get set aside rather than forced into a theme, and it tells you
how many. Inventing a theme for every row would make the totals look better and
mean less.

**1:15 to 1:55, the toggle. This is the demo.**

Click "By mentions". Pause. Click "By organisations".

This took the longest to get right.

One organisation writes a twelve page submission. It arrives as twelve rows.
Count rows, and that one organisation looks like twelve people. It buries a
concern that eight separate organisations each raised once.

On mentions, the ranking is loudest first. On organisations, most widely held
first. Same data, one click, different top of the list.

For an analyst those are two different questions, and only the second survives a
committee.

Switch to tab 2, the full 223 rows.

That was four organisations. Here is the full consultation, two hundred and
twenty three responses from nineteen organisations.

**1:55 to 2:10, the quotes**

Scroll to the ranked list. Hover one bar to show the organisation names.

Every theme carries the organisations that raised it and one real quote. The
quote is chosen to be readable — early versions opened with things like "Page 2
of 18", so page furniture and mid sentence openings are penalised harder than
any keyword can score.

**2:10 to 2:35, the part that answers "why trust it"**

Open one theme's source rows. Say it plainly:

Don't trust it. Every theme lists the rows it was built from, with the row id
from her own file. The themes are Gemini's. The text is not — the model is asked
for a label, and the code that applies it cannot touch the response text. So she
checks row 47 against row 47 in her spreadsheet.

"Download source rows" exports exactly that comparison as a CSV. "Save as PDF"
prints the report with every source row expanded, for the committee pack.

If a mentor or judge asked you how this can be trusted, this is the beat that
answers them. Do not let it slip to the end.

**2:35 to 2:50, what it does not do**

Claim the middle of the workflow, never the whole of it. "End to end" is the one
phrase that invites every question you cannot answer.

Say it in one breath, it is 12 seconds and it has to stay that way:

This is not the whole job. Collecting the submissions sits upstream, the
authority's formal response sits downstream. This is the step in the middle that
takes two months.

English only. It does not tell you whether a response supports or opposes the
proposal, only what it is about. We cut stance deliberately, because a wrong
stance label on a public objection is worse than no label.

**2:50 to 3:00, close**

She still reads the responses. She reads them knowing which eight arguments
matter and who made them, instead of finding that out in week six.

Then stop talking.

## Cut to 90 seconds

Keep: the two month line, the live run, the toggle, the source rows, one
sentence of limits, and the "step in the middle" line. That last one is 12
seconds and it stops the end-to-end question before it is asked.
Drop: the tiles walkthrough, the quote quality story, tab 2.

The source rows stay even in the short version. It is the only part of this that
a room full of AI demos has not already seen.

## If they give you five minutes

Add the accuracy answer below, and one sentence on why there is no database:
the analysis is stateless, so a database was scope that bought nothing.

## Questions to expect

**How accurate is it?**

Measured on `data/trai_sample_labeled.csv`: 40 rows of real TRAI submissions,
labelled row by row. Say it like this, both numbers, always with the denominator:

> The boilerplate gate is 11 out of 11, with nothing wrongly kept. Of the 29 rows
> that carry a real argument, 22 got the right theme. That is 76% end to end, and
> 92% of the rows it chose to keep. I quote both, because the first is what the
> analyst actually gets and the second flatters us.

Then the honest part, unprompted, before they ask:

> The labels were drafted by a different model family from the one being scored
> and then reviewed by hand. The equivalence checker is Gemini grading Gemini, so
> treat it as a sanity check, not an independent benchmark.

Never say a round hundred percent. It invites exactly one follow up and you lose
the room.

**Where does it get things wrong?** Have this ready, it buys more credit than the
score does. Two failure modes, both real, both on screen in the benchmark output:

- Five of 29 real arguments were set aside as boilerplate. Four of those five open
  with document furniture — a footnote, a section heading, a bare list of
  definitions — so the gate had a case. One was a straight miss.
- Two themes came back too vague after merging: spectrum management collapsed into
  "economic and service benefits", adoption barriers into "holistic policy
  strategy". The merge step is where this loses precision.

Re-run before you quote it if the answer key changed:
`node --env-file=.env scripts/benchmark.ts data/trai_sample_labeled.csv`

**How do we know the source rows are real, and not more AI output?**

Because the model is never asked for them. Gemini returns a label —
substantive, theme, key point. The code that applies it spreads a type with no
text field over the uploaded row, so it cannot rewrite a response even if it
tried. The text on screen is the text in the file. "Download source rows" gives
them the CSV to check it against the original, row id by row id.

Then say the other half before they ask: the themes *are* model output and can
be wrong. That is exactly why the rows are there.

**What happens when the model is unsure?**
When a chunk does not state a position we do not invent a theme for it. We set
it aside and tell you how many we set aside. That number is on the screen.

**Is this sentiment analysis?**
No. Sentiment gives you a mood. This gives you the argument. We deliberately do
not do stance.

**Why not keyword search or topic modelling?**
Keyword search needs to know the words in advance, and objections are written in
ordinary language, not the plan's vocabulary. Topic modelling returns clusters
of words that a human still has to name. This returns a sentence an analyst can
put in a report.

**What about form letters, when five thousand people send the same paragraph?**

Expect this one. Your own opening line sets it up, and anyone who has worked on a
consultation will ask it. Do not reach for the row cap as an answer, it sounds
like dodging. Answer it as the same problem one level down:

> Same distortion, one level down. Counting rows lets one voice look like many,
> which is why we rank by distinct submitters rather than mentions. An organised
> campaign is that same distortion at the individual level: identical text from
> five thousand people is one argument, not five thousand, and ranking by
> submitters would put it straight at the top. Detecting it is exact text
> matching, no model needed. It is the next thing we would build and it is not in
> this build.

Do not claim the org toggle solves it. It solves one organisation writing twelve
pages, which is a different shape.

**Where does the CSV come from?**
A human, today. Converting PDFs and portal exports into rows is upstream of this
and we did not build it. Say it flat, then say why the boundary is where it is:
the conversion step is well served by existing tools, and the part nobody has is
the reading.

**Does it scale to forty nine thousand?**
Not on a free tier key, and the cap is set to three hundred rows for that
reason. The limit is request pacing, not the design. The page says when a file
was truncated rather than quietly reading part of it.

**Why is the team one person?**
Answer it flat and move on. The build is solo, the organisers know, and it is on
the milestone sheet.
