function getRandomInteger(min, max) {
    return min + Math.round(Math.random() * (max - min))
}

module.exports = {getRandomInteger}
