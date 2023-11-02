'use strict';

/////////////////////////////////////////////
// WORKOUT CLASS
/////////////////////////////////////////////
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

/////////////////////////////////////////////
// RUNNING CLASS
/////////////////////////////////////////////
class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

/////////////////////////////////////////////
// CYCLING CLASS
/////////////////////////////////////////////
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

////////////////////////////////////////////
// APPLICATION ARCHITECTURE
/////////////////////////////////////////////
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const editButton = document.querySelectorAll('.edit-btn');
const alert = document.querySelector('.alert');
let editWorkout;
let markerArray = [];
let marker;

/////////////////////////////////////////////
// APP CLASS
/////////////////////////////////////////////
class App {
  #map;
  #mapEvent;
  #workouts = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  /////////////////////////////////////////////
  // MAP FUNCTIONS
  /////////////////////////////////////////////

  // GET POSITION
  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  // LOAD MAP
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, 13);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showform.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  // RENDER WORKOUT MARKER
  _renderWorkoutMarker(workout) {
    marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      );

    markerArray.push(marker);
    marker.openPopup();
  }

  // MOVE TO POPUP
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    const editEl = e.target.closest('.edit-btn');
    if (!workoutEl) return;
    if (editEl) this._showEditForm(editEl);

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, 13, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  /////////////////////////////////////////////
  // REGULAR WORKOUT FUNCTIONS
  /////////////////////////////////////////////

  //NEW WORKOUT
  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._showAlert(0, 'Error', 'Input values are not valid...');
        inputDistance.value =
          inputDuration.value =
          inputCadence.value =
          inputElevation.value =
            '';
        inputDistance.focus();
        return;
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        inputDistance.value =
          inputDuration.value =
          inputCadence.value =
          inputElevation.value =
            '';
        inputDistance.focus();
        this._showAlert(0, 'Error', 'Input values are not valid...');
        return;
      }

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);
    // Render workout on list
    this._renderWorkout(workout);
    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    this._showAlert(1, 'Success', 'Workout has been created...');
  }

  // RENDER WORKOUT
  _renderWorkout(workout, formEdit, editWorkout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
    <button class="edit-btn">
    <ion-icon name="create-outline"></ion-icon>
  </button>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">mi</span>
        </div>
        <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
        </div>`;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/mi</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">mi/h</span>
        </div>
        <div class="workout__details">
            <span class="workout__icon">🗻</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
        </div>
    </li>`;

    if (formEdit) {
      editWorkout.remove();
      formEdit.insertAdjacentHTML('beforebegin', html);
    }

    if (!formEdit) form.insertAdjacentHTML('afterend', html);
  }

  /////////////////////////////////////////////
  // EDITING WORKOUT FUNCTIONS
  /////////////////////////////////////////////

  // DELETE WORKOUT
  _deleteWorkout(
    e,
    workoutID,
    formEdit,
    formDistance,
    formDuration,
    formCadence,
    formElevation
  ) {
    e.preventDefault();
    const objIndex = this.#workouts.findIndex(o => o.id === workoutID);
    const obj = this.#workouts.find(o => o.id === workoutID);
    this.#workouts.splice(objIndex, 1);
    this._clearEditForm(formDistance, formDuration, formCadence, formElevation);
    this._hideEditForm(formEdit);
    this._removeMarkerAtIndex(obj);
    formEdit.remove();
    this._showAlert(1, 'Success', 'Workout has been deleted...');
  }

  // EDIT WORKOUT
  _editWorkout(
    e,
    editWorkout,
    workoutID,
    formEdit,
    formType,
    formDistance,
    formDuration,
    formCadence,
    formElevation
  ) {
    e.preventDefault();

    const obj = this.#workouts.find(o => o.id === workoutID);
    let newWorkout;
    const newWorkoutDistance = +formDistance.value;
    const newWorkoutDuration = +formDuration.value;

    if (formType.value === 'running') {
      const newWorkoutCadence = +formCadence.value;

      if (
        this._checkInputs(
          newWorkoutDistance,
          newWorkoutDuration,
          newWorkoutCadence
        ) === false
      ) {
        this._clearEditForm(
          formDistance,
          formDuration,
          formCadence,
          formElevation
        );
        this._showAlert(0, 'Error', 'Input values are not valid...');
        return;
      }
      newWorkout = new Running(
        obj.coords,
        formDistance.value,
        formDuration.value,
        formCadence.value
      );
      newWorkout.type = 'running';
      const word = 'Running';
      let words = obj.description.split(' ');
      words[0] = word;
      newWorkout.description = words.join(' ');
    }
    if (formType.value === 'cycling') {
      const newWorkoutElevation = +formElevation.value;

      if (
        this._checkInputs(
          newWorkoutDistance,
          newWorkoutDuration,
          newWorkoutElevation
        ) === false
      ) {
        this._clearEditForm(
          formDistance,
          formDuration,
          formCadence,
          formElevation
        );
        this._showAlert(0, 'Error', 'Input values are not valid...');
        return;
      }

      newWorkout = new Cycling(
        obj.coords,
        formDistance.value,
        formDuration.value,
        formElevation.value
      );
      const word = 'Cycling';
      let words = obj.description.split(' ');
      words[0] = word;
      newWorkout.description = words.join(' ');
      newWorkout.type = 'cycling';
    }

    newWorkout.date = obj.date;
    newWorkout.id = obj.id;

    this.#workouts.push(newWorkout);
    this._clearEditForm(formDistance, formDuration, formCadence, formElevation);
    this._hideEditForm(formEdit);
    this._renderWorkout(newWorkout, formEdit, editWorkout);
    this._renderWorkoutMarker(newWorkout);
    this._removeMarkerAtIndex(newWorkout);
    formEdit.remove();
    this.#workouts.splice(
      this.#workouts.findIndex(o => o.id === workoutID),
      1
    );
    this._showAlert(1, 'Success', 'Workout has been updated...');
  }

  _removeMarkerAtIndex(newWorkout) {
    let markerFound = markerArray.findIndex(
      mark => mark._latlng.lat === newWorkout.coords[0]
    );
    if (typeof markerFound === 'number') {
      this.#map.removeLayer(markerArray[markerFound]);
      markerArray.splice(markerFound, 1);
    }
  }

  /////////////////////////////////////////////
  // REGULAR FORM FUNCTIONS
  /////////////////////////////////////////////

  // SHOW FORM
  _showform(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  // HIDE FORM
  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  // TOGGLE TYPE FIELD
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  /////////////////////////////////////////////
  // EDIT FORM FUNCTIONS
  /////////////////////////////////////////////

  // SHOW EDIT FORM
  _showEditForm(e) {
    editWorkout = e.closest('.workout');
    const html = `<form class="form-edit">
    <div class="form__row form_row--edit">
      <label class="form__label">Type</label>
      <select class="form__input form__input--type form__input--type-edit">
        <option value="running">Running</option>
        <option value="cycling">Cycling</option>
      </select>
    </div>
    <div class="form__row form_row--edit">
      <label class="form__label">Distance</label>
      <input class="form__input form__input--distance form__input--distance-edit" placeholder="mi" />
    </div>
    <div class="form__row form_row--edit">
      <label class="form__label">Duration</label>
      <input
        class="form__input form__input--duration form__input--duration-edit"
        placeholder="min"
      />
    </div>
    <div class="form__row form_row--edit">
      <label class="form__label">Cadence</label>
      <input
        class="form__input form__input--cadence form__input--cadence-edit"
        placeholder="step/min"
      />
    </div>
    <div class="form__row form__row--hidden form_row--edit">
      <label class="form__label">Elev Gain</label>
      <input
        class="form__input form__input--elevation form__input--elevation-edit"
        placeholder="feet"
      />
    </div>
    <button class="form-btn form-update">UPDATE</button>
    <button class="form-btn form-delete">DELETE</button>
  </form>`;
    editWorkout.classList.add('hidden');
    editWorkout.insertAdjacentHTML('beforebegin', html);
    const formEdit = document.querySelector('.form-edit');
    const formUpdateBtn = document.querySelector('.form-update');
    const formDeleteBtn = document.querySelector('.form-delete');
    const workoutID = editWorkout.dataset.id;
    const formType = document.querySelector('.form__input--type-edit');
    const formDistance = document.querySelector('.form__input--distance-edit');
    const formDuration = document.querySelector('.form__input--duration-edit');
    const formCadence = document.querySelector('.form__input--cadence-edit');
    const formElevation = document.querySelector(
      '.form__input--elevation-edit'
    );

    formDistance.focus();
    formUpdateBtn.addEventListener('click', e =>
      this._editWorkout(
        e,
        editWorkout,
        workoutID,
        formEdit,
        formType,
        formDistance,
        formDuration,
        formCadence,
        formElevation
      )
    );

    formDeleteBtn.addEventListener('click', e =>
      this._deleteWorkout(
        e,
        workoutID,
        formEdit,
        formDistance,
        formDuration,
        formCadence,
        formElevation
      )
    );

    formType.addEventListener('change', function () {
      formElevation.closest('.form__row').classList.toggle('form__row--hidden');
      formCadence.closest('.form__row').classList.toggle('form__row--hidden');
    });
  }

  // HIDE EDIT FORM
  _hideEditForm(formEdit) {
    formEdit.style.display = 'none';
    formEdit.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  // CLEAR EDIT FORM
  _clearEditForm(formDistance, formDuration, formCadence, formElevation) {
    formDistance.value =
      formDuration.value =
      formCadence.value =
      formElevation.value =
        '';
    formDistance.focus();
  }

  /////////////////////////////////////////////
  // MISCELLANEOUS FUNCTIONS
  /////////////////////////////////////////////

  // CHECK INPUTS
  _checkInputs(...inputs) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    if (!validInputs(...inputs) || !allPositive(...inputs)) return false;
    if (validInputs(...inputs) || allPositive(...inputs)) return true;
  }

  // SHOW ALERT
  _showAlert(type, header, message) {
    const alertMessageHeader = document.querySelector('.alert-message-1');
    const alertMessageBody = document.querySelector('.alert-message-2');

    alertMessageHeader.textContent = header;
    alertMessageBody.textContent = message;

    if (type === 0) alert.style.backgroundColor = '#c92a2a';
    if (type === 1) alert.style.backgroundColor = '#2b8a3e';

    alert.classList.add('show');
    setTimeout(() => {
      alert.classList.remove('show');
    }, 3000);
  }

  // SET LOCAL STORAGE
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  // GET LOCAL STORAGE
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // RESET
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
