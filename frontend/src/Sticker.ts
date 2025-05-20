
import env from "../../env"

const prefix = env.api + "/img/";
export const Stickers = [
    prefix + "chickenLegs.jpg",
    prefix + "snek.jpg",
    prefix + "actionFigure.jpg"
];

let current = -1;

export function getStickerIndex():number {
    const count = Stickers.length;
    current += 1;
    if (current == count) {
        current = 0;
    }

    return current;
}