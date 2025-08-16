"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Function to generate a random boolean
function getRandomBoolean() {
    return Math.random() < 0.5;
}
// Function to generate a random number within a range
function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
}
// Array of possible move directions
var moveDirections = [
    'NONE', 'FORWARD', 'BACKWARD', 'LEFT', 'RIGHT',
    'FORWARD_LEFT', 'FORWARD_RIGHT', 'BACKWARD_LEFT', 'BACKWARD_RIGHT'
];
// Function to generate a random BaritoneAction
function generateRandomBaritoneAction() {
    return {
        look_change: {
            yaw: getRandomNumber(-180, 180),
            pitch: getRandomNumber(-90, 90)
        },
        move_direction: moveDirections[Math.floor(Math.random() * moveDirections.length)],
        jump: getRandomBoolean(),
        sneak: getRandomBoolean(),
        sprint: getRandomBoolean()
    };
}
// Read from stdin and output random BaritoneAction
process.stdin.on('data', function (chunk) {
    // We don't actually process the input chunk, just respond with a random action
    var randomAction = generateRandomBaritoneAction();
    process.stdout.write(JSON.stringify(randomAction) + '\n');
});
process.stdin.on('end', function () {
    process.stderr.write('Input stream closed.\n');
});
process.stderr.write('Line reader script started. Outputting random BaritoneAction JSON...\n');
