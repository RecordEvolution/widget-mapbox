// randomizer.js

// Helper function to deep clone an object
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj))
}

// Function to randomize object values based on key paths
function randomizeObjectValues(obj, keyPathsToRandomize) {
    const newObj = deepClone(obj)

    keyPathsToRandomize.forEach((keyPath) => {
        const keys = keyPath.split('.')
        let currentObj = newObj

        for (let i = 0; i < keys.length - 1; i++) {
            if (!currentObj[keys[i]]) {
                return
            }
            currentObj = currentObj[keys[i]]
        }

        const lastKey = keys[keys.length - 1]

        if (currentObj.hasOwnProperty(lastKey)) {
            const value = currentObj[lastKey]

            // Randomize the value (example: shuffle an array)
            if (Array.isArray(value)) {
                // Shuffle the array
                currentObj[lastKey] = shuffleArray(value)
            } else if (typeof value === 'string') {
                // Randomize the characters of a string
                currentObj[lastKey] = randomizeString(value)
            } else if (typeof value === 'number') {
                currentObj[lastKey] = (1 + (Math.random() - 0.5) * 0.3) * value
            }
            // You can add more cases for other data types if needed
        }
    })

    return newObj
}

// Helper function to shuffle an array
function shuffleArray(arr) {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

// Helper function to randomize a string
function randomizeString(str) {
    const array = str.split('')
    const shuffledArray = shuffleArray(array)
    return shuffledArray.join('')
}

// Attach the randomizeObjectValues function to the global window object
window.randomizeObjectValues = randomizeObjectValues
