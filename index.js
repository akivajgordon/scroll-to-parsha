;(async () => {
  const STEPS = {
    selectParsha: 'SELECT_PARSHA',
    uploadPicture: 'UPLOAD_PICTURE',
    results: 'RESULTS',
  }
  const state = {
    step: STEPS.selectParsha,
    pageFromImage: 0,
    selectedParshaIndex: 0,
  }

  const setStep = (step) => {
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

  const fetchAndPopulateParshiyot = async () => {
    const parshiyot = await fetchParshiyot()
    parshiyot.forEach((parsha, index) => {
      const option = new Option(`${parsha.en} - ${parsha.he}`, index)
      select.options.add(option)
    })

    return parshiyot
  }

  const fetchCleaned = async () => (await fetch('cleaned.json')).json()

  const prepareWorker = async () => {
    try {
      await worker.load()
      await worker.loadLanguage('heb')
      await worker.initialize('heb')
      await worker.setParameters({
        tessedit_char_whitelist: 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ',
        preserve_interword_spaces: '1',
      })
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  // placeholder
  select.options.add(new Option('Choose a Parsha...', -1))

  const [parshiyot, pages] = await Promise.all([
    fetchAndPopulateParshiyot(),
    fetchCleaned(),
    prepareWorker(),
  ])

  const animateUploadPictureButton = () => {
    document.querySelector('#upload-picture label').classList.add('fade-in-up')
  }

  const animateMissingInfoMessage = (messageContainer, message, animation) => {
    const upload = document.querySelector('#upload-picture')

    upload.style.display = 'initial'
    document.body.style.justifyContent = 'center'
    messageContainer.innerHTML = message
    messageContainer.classList.add(animation)
  }

  const renderMissingInfoMessage = (messageContainer, message, animation) => {
    messageContainer.onanimationend = () => {
      messageContainer.classList.remove(animation)
      animateUploadPictureButton()
    }

    animateMissingInfoMessage(messageContainer, message, animation)
  }

  const resultMessage = (selectedParshaIndex, pageFromImage) => {
    const startPageOfSelectedParsha =
      parshiyot[selectedParshaIndex - 1].startPage

    const columnsToScroll = startPageOfSelectedParsha - pageFromImage

    const needsToAdvance = columnsToScroll > 0

    return columnsToScroll === 0
      ? `<h2 style="text-align: center;">You're already there!</h2>
          <p>Feel free to take another picture to see if you need to make any
          adjustments.</p>`
      : `<h2 style="text-align: center;">${
          needsToAdvance ? 'Advance' : 'Go backwards'
        } ${Math.abs(columnsToScroll)} columns
          </h2>
          <div style="position: relative;
            display: flex; justify-content: center; align-items: center;">
            <img src="torah-scroll.png" alt="Torah Scroll"
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
  }

  const renderResult = () => {
    const messageContainer = document.querySelector('#message')

    const message = resultMessage(
      state.selectedParshaIndex,
      state.pageFromImage
    )

    messageContainer.firstChild.onanimationend = () => {
      messageContainer.innerHTML = message
      for (let i = 0; i < messageContainer.children.length; ++i) {
        messageContainer.children[i].classList.add('fade-in-down')
      }
    }

    messageContainer.firstChild.classList.add('fade-out-down')
  }

  const renderSelectParsha = () => {
    const message = `<p>It looks like you're on column ${state.pageFromImage}.</p>
      <p>Select a parsha so we know where you need to scroll to.</p>`

    renderMissingInfoMessage(
      document.querySelector('#message'),
      message,
      'fade-in-down'
    )
  }

  const renderUploadPicture = () => {
    const message = `<p>Now take a picture of the open Torah
    scroll so we know what you're looking at.</p>`
    const messageContainer = document.querySelector('#message')
    const selectWrapper = document.querySelector('#select-parsha').parentNode

    selectWrapper.onanimationend = () => {
      messageContainer.classList.remove('fade-out-up')
      renderMissingInfoMessage(messageContainer, message, 'fade-in-up')
    }

    messageContainer.onanimationend = () => {
      selectWrapper.classList.add('move-to-top')
    }

    messageContainer.classList.add('fade-out-up')
  }

  const onSelectedParshaChange = (e) => {
    state.selectedParshaIndex = e.target.selectedIndex

    const previousStep = getStep()

    // same screen and still need image, nothing to re-animate
    if (!pageFromImage() && previousStep === STEPS.uploadPicture) return

    setStep(STEPS.uploadPicture)

    if (pageFromImage()) {
      if (parshaIsSelected()) {
        renderResult()
      } else {
        renderSelectParsha()
      }
    } else if (parshaIsSelected()) {
      renderUploadPicture()
    }
  }

  select.addEventListener('change', onSelectedParshaChange)

  const renderAnalyzePicture = () => {
    const messageContainer = document.querySelector('#message')

    // update and move message back up to center
    messageContainer.firstChild.onanimationend = () => {
      document.body.style.justifyContent = 'center'
      messageContainer.style.marginBottom = '0'

      messageContainer.innerHTML = `<h2 class="fade-in-down"
        style="text-align: center;">Analyzing the picture...</h2>
        <i class="fa-regular fa-2x fa-circle-notch fa-spin"
        style="display: flex; justify-content: center;"></i>`
    }

    messageContainer.firstChild.classList.add('fade-out-down')
  }

  const pageFromImage = () => {
    return state.pageFromImage > 0
  }

  const parshaIsSelected = () => {
    return state.selectedParshaIndex > 0
  }

  document.querySelector('#image').addEventListener('change', async (e) => {
    const files = e.target.files
    if (!(files || files.length)) return

    setStep(STEPS.results)

    const file = await imageCompression(files[0], {
      maxSizeMB: 0.5,
      onProgress: console.log,
    })

    renderAnalyzePicture()

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

    state.pageFromImage = pageWithHighestScore + 1

    if (pageFromImage()) {
      if (parshaIsSelected()) {
        renderResult()
      } else {
        renderSelectParsha()
      }
    }
  })
})()
