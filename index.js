;(async () => {
  const select = document.querySelector('#select-parsha')

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

  // maybe do this after all the parshiyot are fetched?
  select.options.add(new Option('Choose a Parsha...', -1))

  const [parshiyot] = await Promise.all([fetchParshiyot(), prepareWorker()])

  parshiyot.forEach((parsha, index) => {
    const option = new Option(`${parsha.en} - ${parsha.he}`, index)
    select.options.add(option)
  })

  const pages = await (await fetch('cleaned.json')).json()

  select.addEventListener('change', () => {
    const SELECT_PARSHA_TRANSITION_DURATION_MS = 400 + 400;
    const message = document.querySelector('#message')
    message.classList.add('fade-out-up')
    select.parentNode.style.top = '5%'

    setTimeout(() => {
      const MESSAGE_TRANSITION_DURATION_MS = 200;
      // fade in the upload button
      const upload = document.querySelector('#upload-picture')

      message.innerHTML = `<p>Now take a picture of the open Torah scroll so we
        know what you're looking at.</p>`
      message.classList.remove('fade-out-up')
      message.classList.add('fade-in-up')
      message.style.marginBottom = '15%'
      document.body.style.justifyContent = 'flex-end'

      upload.parentNode.insertBefore(message, upload)

      setTimeout(() => {
        upload.style.display = 'initial'
        upload.style.opacity = '1'
        upload.style.top = '90%'

        document.querySelector('#upload-picture label').classList.add('fade-in-up')
      }, MESSAGE_TRANSITION_DURATION_MS)
    }, SELECT_PARSHA_TRANSITION_DURATION_MS)
  })

  document.querySelector('#image').addEventListener('change', async (e) => {
    const files = e.target.files
    if (!(files || files.length)) return

    const file = await imageCompression(files[0], {
      maxSizeMB: 0.5,
      onProgress: console.log,
    })

    const messageContainer = document.querySelector('#message')
    const uploadPicture = document.querySelector('#upload-picture')

    document.body.style.justifyContent = 'center'
    messageContainer.style.marginBottom = '0'
    messageContainer.innerHTML = `<h2 class="fade-in-down" style="text-align: center;">Analyzing...</h2>`

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
    const selectedParshaIndex = select.selectedIndex - 1

    // No Parsha was chosen
    if (selectedParshaIndex < 0) return

    const startPageOfSelectedParsha = parshiyot[selectedParshaIndex].startPage

    const pageFromImage = pageWithHighestScore + 1

    const columnsToScroll = startPageOfSelectedParsha - pageFromImage

    const needsToAdvance = columnsToScroll > 0

    const message =
      columnsToScroll === 0
        ? `You're already there!`
        : `<h2 style="text-align: center;">${
            needsToAdvance ? 'Advance' : 'Go backwards'
          } ${Math.abs(columnsToScroll)} columns</h2><i class="fa-solid fa-3x ${needsToAdvance ? 'fa-arrow-left' : 'fa-arrow-right'}" style="display: block; text-align: center;"></i><p>You need to get to column
          ${startPageOfSelectedParsha}, but it looks like you're currently on
          column ${pageFromImage}.</p><p>When you get there, feel free to take another
          picture to make any adjustments.</p>`

    messageContainer.innerHTML = message
    for (let i = 0; i < messageContainer.children.length; ++i) {
      messageContainer.children[i].classList.add('fade-in-down')
    }
  })
})()
