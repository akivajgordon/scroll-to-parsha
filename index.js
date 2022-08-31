;(async () => {
  const select = document.querySelector('#select')

  const worker = Tesseract.createWorker({
    logger: (m) => console.log(m),
    errorHandler: (e) => console.error(e),
  })

  const fetchParshiyot = async () =>
    (await fetch('parshiyot-with-starts.json')).json()

  const prepareWorker = async () => {
    await worker.load()
    await worker.loadLanguage('heb')
    await worker.initialize('heb')
    await worker.setParameters({
      tessedit_char_whitelist: 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ',
      preserve_interword_spaces: '1',
    })
  }

  const [parshiyot] = await Promise.all([fetchParshiyot(), prepareWorker()])

  parshiyot.forEach((parsha, index) => {
    const option = new Option(parsha.he, index)
    select.options.add(option)
  })

  const pages = await (await fetch('cleaned.json')).json()

  document.querySelector('#image').addEventListener('change', async (e) => {
    const files = e.target.files
    if (!(files || files.length)) return

    const file = await imageCompression(files[0], {
      maxSizeMB: 0.5,
      onProgress: console.log,
    })

    document.querySelector('#loading').innerHTML = 'Loading...'

    const {
      data: { text },
    } = await worker.recognize(file)

    const scores = pages.map((pageText) => {
      return stringSimilarity.compareTwoStrings(
        text.replace(/[^א-ת]/g, ''),
        pageText
      )
    })

    const highestScore = Math.max(...scores)

    const pageWithHighestScore = scores.findIndex(
      (score) => score === highestScore
    )

    console.log({ scores, highestScore, pageWithHighestScore })
    console.log({
      scores: scores
        .map((score, index) => ({ score, page: index + 1 }))
        .sort((a, b) => (a.score - b.score > 0 ? -1 : 1)),
    })
    const selectedParsha = select.selectedIndex

    const startPageOfSelectedParsha = parshiyot[selectedParsha].startPage

    const pageFromImage = pageWithHighestScore + 1

    const columnsToScroll = startPageOfSelectedParsha - pageFromImage

    const needsToAdvance = columnsToScroll > 0

    const message =
      columnsToScroll === 0
        ? `You're already there!`
        : `You need to get to column ${startPageOfSelectedParsha}, but it looks like you're currently on column ${pageFromImage}. You need to ${
            needsToAdvance ? 'advance' : 'go backwards'
          } by ${Math.abs(columnsToScroll)} columns`

    document.querySelector('#loading').innerHTML = message
  })
})()
