"use strict";

const allPlantDefinition = [
    function corn($) {
        $.name("Sunflower");
        $.emoji("🌽");
        $.growthCheckFrequency(2);
        $.growsWhen(({ plant, cell, neighborCells }) => {
            const neighborPlants = neighborCells
                .map(neighborCell => neighborCell.plant)
                .filter(plant => plant !== undefined);
            const isHappy = neighborPlants
                .filter(neighbor => neighbor.type === plant.type)
                .filter(neighbor => neighbor.level == Math.min(1, plant.level - 1))
                .length >= 2;
            return isHappy && cell.soilState.moisture > 0.5 && cell.soilState.nutrients > 0.5;
        });
    },
    function beans($) {
        $.name("Mushroom");
        $.emoji("🫘");
        $.growthCheckFrequency(3);
        $.growsWhen(({ cell, neighborCells }) => {
            const neighborPlants = neighborCells
                .map(neighborCell => neighborCell.plant)
                .filter(plant => plant !== undefined);
            const isHappy = neighborPlants.length <= 2;
            return isHappy && cell.soilState.moisture > 0.2 && cell.soilState.nutrients > 0.25;
        });
    },
];

class InternalPlantType {
    constructor() {
        this.fullName = "plant";
        this.iconicEmoji = "🌱";
        this.growthCheckFrequency = 1;
        this.nextLevel = (ctx) => ctx.plant.level;
    }
}
function internalPlantTypeCompiler(program) {
    const internalPlantType = new InternalPlantType();
    const dsl = {
        name(name) {
            internalPlantType.fullName = name;
        },
        emoji(emoji) {
            internalPlantType.iconicEmoji = emoji;
        },
        growthCheckFrequency(frequency) {
            internalPlantType.growthCheckFrequency = frequency;
        },
        growsWhen(growsWhen) {
            internalPlantType.nextLevel = (ctx) => {
                return ctx.plant.level + (growsWhen(ctx) ? 1 : 0);
            };
        },
    };
    program(dsl);
    return internalPlantType;
}

const allInternalPlantTypes = allPlantDefinition.map(internalPlantTypeCompiler);
console.log(allInternalPlantTypes);