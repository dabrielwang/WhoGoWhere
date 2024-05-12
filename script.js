let map;
let directionService;
let directionRenderer;
let driverRoutes = [];

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 43.8561, lng: -79.3370 },
        zoom: 12
    });
    directionService = new google.maps.DirectionsService();
    directionRenderer = new google.maps.DirectionsRenderer();
    directionRenderer.setMap(map);

    const destinationInput = document.getElementById('destination');
    const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput);
}

let driverCount = 0;
let passengerCount = 0;

function addDriver() {
    driverCount++;
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.setAttribute('for', `driver${driverCount}`);
    label.textContent = `Driver ${driverCount} Location:`;
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('id', `driver${driverCount}`);
    input.setAttribute('placeholder', `Enter driver ${driverCount} location`);
    div.appendChild(label);
    div.appendChild(input);

    const tollCheckboxContainer = document.createElement('div');
    tollCheckboxContainer.classList.add('checkbox-container');
    const tollCheckbox = document.createElement('input');
    tollCheckbox.setAttribute('type', 'checkbox');
    tollCheckbox.setAttribute('id', `toll${driverCount}`);
    const tollLabel = document.createElement('label');
    tollLabel.setAttribute('for', `toll${driverCount}`);
    tollLabel.textContent = 'Avoid Tolls';
    tollCheckboxContainer.appendChild(tollCheckbox);
    tollCheckboxContainer.appendChild(tollLabel);
    div.appendChild(tollCheckboxContainer);

    const highwayCheckboxContainer = document.createElement('div');
    highwayCheckboxContainer.classList.add('checkbox-container');
    const highwayCheckbox = document.createElement('input');
    highwayCheckbox.setAttribute('type', 'checkbox');
    highwayCheckbox.setAttribute('id', `highway${driverCount}`);
    const highwayLabel = document.createElement('label');
    highwayLabel.setAttribute('for', `highway${driverCount}`);
    highwayLabel.textContent = 'Avoid Highways';
    highwayCheckboxContainer.appendChild(highwayCheckbox);
    highwayCheckboxContainer.appendChild(highwayLabel);
    div.appendChild(highwayCheckboxContainer);

    const maxPassengersContainer = document.createElement('div');
    maxPassengersContainer.classList.add('max-passengers-container');
    const maxPassengersLabel = document.createElement('label');
    maxPassengersLabel.setAttribute('for', `maxPassengers${driverCount}`);
    maxPassengersLabel.textContent = 'Max Passengers:';
    const maxPassengersInput = document.createElement('input');
    maxPassengersInput.setAttribute('type', 'number');
    maxPassengersInput.setAttribute('id', `maxPassengers${driverCount}`);
    maxPassengersInput.setAttribute('min', 1);
    maxPassengersInput.setAttribute('value', 1);
    maxPassengersInput.setAttribute('placeholder', 'Max Passengers');
    maxPassengersContainer.appendChild(maxPassengersLabel);
    maxPassengersContainer.appendChild(maxPassengersInput);
    div.appendChild(maxPassengersContainer);

    driverInputs.appendChild(div);
        
    const autocomplete = new google.maps.places.Autocomplete(input);
}

function addPassenger() {
    passengerCount++;
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.setAttribute('for', `passenger${passengerCount}`);
    label.textContent = `Passenger ${passengerCount} Location:`;
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('id', `passenger${passengerCount}`);
    input.setAttribute('placeholder', `Enter passenger ${passengerCount} location`);
    div.appendChild(label);
    div.appendChild(input);

    passengerInputs.appendChild(div);

    const autocomplete = new google.maps.places.Autocomplete(input);
}

async function calculateRoute() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 43.8561, lng: -79.3370 },
        zoom: 12
    });

    const routeLinksContainer = document.getElementById('route-links-container');
    routeLinksContainer.innerHTML = '';

    const numDrivers = driverCount;
    const numPassengers = passengerCount;
    const destination = document.getElementById('destination').value;

    const drivers = [];
    const passengers = [];
    const maxPassengers = [];

    const totalMaxPassengers = maxPassengers.reduce((sum, count) => sum + count, 0);
    const totalPassengers = passengers.length;

    const errorContainer = document.getElementById('error-container');
    errorContainer.innerHTML = '';

    if (totalPassengers > totalMaxPassengers) {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'Error: The total number of passengers exceeds the combined maximum capacity of the drivers.';
        errorContainer.appendChild(errorMessage);
        return;
    }

    for (let i = 1; i <= numDrivers; i++) {
        drivers.push(document.getElementById(`driver${i}`).value);
        maxPassengers.push(parseInt(document.getElementById(`maxPassengers${i}`).value));
    }

    for (let i = 1; i <= numPassengers; i++) {
        passengers.push(document.getElementById(`passenger${i}`).value);
    }

    const passengerLocations = passengers.map(passenger => ({ location: passenger }));
    const passengerGroupings = groupArray(passengerLocations, numDrivers);

    let shortestTotalTime = Infinity;
    let optimalGrouping = null;

    const routesPromises = passengerGroupings.map(async (grouping) => {
        const isValidGrouping = grouping.every((passengers, index) => passengers.length <= maxPassengers[index]);

        if (!isValidGrouping) {
            return null;
        }

        const routesWithDuration = await Promise.all(drivers.map((driver, index) => {
            const passengersForDriver = grouping[index];
            return calculateRouteForDriver(driver, passengersForDriver, destination, index + 1);
        }));

        const totalTime = routesWithDuration.reduce((sum, result) => sum + result.duration, 0);

        return { grouping, totalTime };
    });

    const routesResults = await Promise.all(routesPromises);

    for (const result of routesResults) {
        if (result && result.totalTime < shortestTotalTime) {
            shortestTotalTime = result.totalTime;
            optimalGrouping = result.grouping;
        }
    }

    if (optimalGrouping) {
        driverRoutes = await Promise.all(drivers.map((driver, index) => {
            const passengersForDriver = optimalGrouping[index];
            return calculateRouteForDriver(driver, passengersForDriver, destination, index + 1);
        }));

        driverRoutes.forEach((result, index) => {
            if (result.response && result.response.routes && result.response.routes.length > 0) {
                const directionsRenderer = new google.maps.DirectionsRenderer({
                    map: map,
                    directions: result.response,
                    polylineOptions: {
                        strokeColor: getRandomColor(),
                        strokeOpacity: 1.0,
                        strokeWeight: 5
                    }
                });
            
                const route = result.response.routes[0];
                const driverLocation = route.legs[0].start_address;
                const passengerLocations = route.waypoint_order.map(index => route.legs[index + 1].start_address);

                const routeLink = document.createElement('a');
                routeLink.textContent = `Driver ${index + 1}: Route Link`;
                routeLink.href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(driverLocation)}&destination=${encodeURIComponent(route.legs[route.legs.length - 1].end_address)}&waypoints=${encodeURIComponent(passengerLocations.join('|'))}`;
                routeLink.target = '_blank';

                routeLinksContainer.appendChild(routeLink);
                routeLinksContainer.appendChild(document.createElement('br'));
            } else {
                console.log("Invalid response from Directions API:", result.response);
            }
        });
    } else {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'Error: No valid routes found.';
        errorContainer.appendChild(errorMessage);
    }
}

function calculateRouteForDriver(origin, waypoints, destination, driverIndex) {
    const avoidTolls = document.getElementById(`toll${driverIndex}`).checked;
    const avoidHighways = document.getElementById(`highway${driverIndex}`).checked;

    return new Promise((resolve, reject) => {
        directionService.route({
            origin: origin,
            destination: destination,
            waypoints: waypoints.map(waypoint => ({ location: waypoint.location, })),
            optimizeWaypoints: true,
            travelMode: 'DRIVING',
            avoidTolls: avoidTolls,
            avoidHighways: avoidHighways
        }, (response, status) => {
            if (status === 'OK') {
                const route = response.routes[0];
                const duration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
                resolve({ response, duration });
            } else {
                console.log("Directions API request failed with status:", status);
                reject(new Error('Directions request failed due to ' + status));
            }
        });
    });
}
      
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function groupArray(arr, n) {
    const result = [];
  
    function backtrack(index, groups) {
      if (index === arr.length) {
        result.push(groups.map(group => group.slice()));
        return;
      }
  
      for (let i = 0; i < groups.length; i++) {
        groups[i].push(arr[index]);
        backtrack(index + 1, groups);
        groups[i].pop();
      }
    }
  
    backtrack(0, Array(n).fill().map(() => []));
    return result;
  }