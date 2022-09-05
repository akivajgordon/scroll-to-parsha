;(async () => {
  const STEPS = {
    selectParsha: 'SELECT_PARSHA',
    uploadPicture: 'UPLOAD_PICTURE',
    results: 'RESULTS'
  }
  const state = {
    step: STEPS.selectParsha
  }

  const setStep = step => {
    state.step = step
  }

  const getStep = () => state.step

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

  // placeholder
  select.options.add(new Option('Choose a Parsha...', -1))

  const [parshiyot] = await Promise.all([fetchParshiyot(), prepareWorker()])

  parshiyot.forEach((parsha, index) => {
    const option = new Option(`${parsha.en} - ${parsha.he}`, index)
    select.options.add(option)
  })

  const pages = await (await fetch('cleaned.json')).json()

  const animateUploadPictureButton = () => {
    document.querySelector('#upload-picture label')
      .classList.add('fade-in-up')
  }

  const animateMessageForUploadPictureButton = message => {
    const upload = document.querySelector('#upload-picture')

    upload.style.display = 'initial'
    document.body.style.justifyContent = 'flex-end'
    message.style.marginBottom = `calc(0.5rem + ${upload.offsetHeight}px)`
    message.classList.add('fade-in-up')
  }

  const startUploadPictureAnimation = (messageContainer, message) => {
    messageContainer.addEventListener(
      'animationend',
      () => {
        messageContainer.classList.remove('fade-in-up')
        animateUploadPictureButton()
      }
    )

    messageContainer.innerHTML = message

    animateMessageForUploadPictureButton(messageContainer)
  }

  select.addEventListener('change', () => {
    const previousStep = getStep()
    if (previousStep === STEPS.uploadPicture) return

    setStep(STEPS.uploadPicture)

    const message = `<p>Now take a picture of the open Torah
      scroll so we know what you're looking at.</p>`

    const messageContainer = document.querySelector('#message')

    if (previousStep === STEPS.selectParsha) {
      const selectWrapper = select.parentNode

      selectWrapper.addEventListener('animationend', e => {
        messageContainer.classList.remove('fade-out-up')
        startUploadPictureAnimation(messageContainer, message)
      })

      messageContainer.addEventListener('animationend', e => {
        selectWrapper.classList.add('move-to-top')
      })

      messageContainer.classList.add('fade-out-up')
    } else {
      startUploadPictureAnimation(messageContainer, message)
    }

  })

  document.querySelector('#image').addEventListener('change', async (e) => {
    const files = e.target.files
    if (!(files || files.length || select.selectedIndex)) return

    setStep(STEPS.results)

    const file = await imageCompression(files[0], {
      maxSizeMB: 0.5,
      onProgress: console.log,
    })

    // update and move message back up to center
    const messageContainer = document.querySelector('#message')

    messageContainer.firstChild.addEventListener('animationend', e => {
      messageContainer.firstChild.classList.remove('fade-in-down')

      document.body.style.justifyContent = 'center'
      messageContainer.style.marginBottom = '0'
      messageContainer.innerHTML = `<h2 class="fade-in-down"
      style="text-align: center;">Analyzing...</h2>`
    })

    messageContainer.firstChild.classList.add('fade-out-down')

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

    const startPageOfSelectedParsha = parshiyot[select.selectedIndex - 1].startPage

    const pageFromImage = pageWithHighestScore + 1

    const columnsToScroll = startPageOfSelectedParsha - pageFromImage

    const needsToAdvance = columnsToScroll > 0

    const message =
      columnsToScroll === 0
        ? `<h2 style="text-align: center;">You're already there!</h2>
          <p>Feel free to take another picture to see if you need to make any
          adjustments.</p>`
        : `<h2 style="text-align: center;">${
            needsToAdvance ? 'Advance' : 'Go backwards'
          } ${Math.abs(columnsToScroll)} columns
          </h2>
          <div style="position: relative;
            display: flex; justify-content: center; align-items: center;">
            <img src="/torah-scroll.png" alt="Torah Scroll"
              class="fa-regular fa-scroll-torah" style="height: 8rem;" />
            <i class="fa-solid fa-3x fa-arrow-${
              needsToAdvance ? 'left' : 'right'
            }" style="position: absolute;">
            </i>
          </div>
          <p>It looks like you're on column ${pageFromImage}, but you need to
          get to column ${startPageOfSelectedParsha}.</p>
          <p>When you get there, feel free to take another
          picture to see if you need to make any adjustments.</p>`

    messageContainer.firstChild.addEventListener('animationend', e => {
      messageContainer.innerHTML = message
      for (let i = 0; i < messageContainer.children.length; ++i) {
        messageContainer.children[i].classList.add('fade-in-down')
      }
    })

    messageContainer.firstChild.classList.add('fade-out-down')
  })
})()
