function getRandomInteger(min, max) {
    return min + Math.round(Math.random() * (max - min))
}

function getCurrentTimestamp() {
    return parseInt(new Date() / 1000);
}

module.exports = {getRandomInteger, getCurrentTimestamp}
