// Fingerprints of the stock values earlier releases gave built-in rows, per
// table (Course by id, Module by slug), row and field. Written by
// scripts/recordStockHistory.js; read by prisma/seed.js through
// src/lib/stockHistory.js, which moves a field still holding one of them to
// the current stock. Do not edit by hand.
export const STOCK_RELEASES = ["7b5763c","c94072f"]

export const STOCK_HISTORY = {
  "Course": {
    "accelerate-brake": {
      "data": [
        "c556f7271aad5735326424c512cea63e"
      ]
    },
    "accelerate-course": {
      "instructions": [
        "9bbeff79f4a68440d143ae3c490774ec"
      ],
      "data": [
        "3272a4a73e4284a22962ad9f41183d56"
      ]
    },
    "controls-intro": {
      "objective": [
        "a0cde765061707fe90c558c5d34a8f30"
      ],
      "instructions": [
        "4b5f057ae01d9251519166aa9a68d086"
      ],
      "hint": [
        "4293f81d8360d3021e5a6fc7e164ccc1"
      ]
    },
    "forklift-gap-parking": {
      "instructions": [
        "2523b9b706df040b399bd5c6942f26a8"
      ]
    },
    "load-handling-briefing": {
      "objective": [
        "003e4cab3222bd92f876b00eb7f57467"
      ],
      "hint": [
        "54d1d1a78227057769d89382bce0bdba"
      ],
      "content": [
        "f6f91ccb75851fe392c0f4bed80ad659",
        "1e7026c7f20eca63372c0a0be175077d"
      ]
    },
    "load-limits": {
      "instructions": [
        "10d7cacbf1ab6d83709b088a85fbedf6"
      ],
      "data": [
        "10296be1745c6d4378181a76bc300a66"
      ]
    },
    "pallet-pickup": {
      "instructions": [
        "3cb5867e155b39adec8e253b25fe330b"
      ],
      "hint": [
        "d62192dcbe1cd5f51a2d5f35faf73863"
      ]
    },
    "pallet-testing-briefing": {
      "hint": [
        "900c1b8b3039fb2333a5b2a861c411d0"
      ]
    },
    "parallel-parking": {
      "instructions": [
        "336a621bcacef10f7e81facc4f52688c"
      ]
    },
    "post-operation-briefing": {
      "content": [
        "2a437fc3c5567772232b3a29f8c30116"
      ]
    },
    "precision-carry": {
      "instructions": [
        "403d50d35cb9d17117ad4fdaef7697ef"
      ],
      "hint": [
        "7ea89f782e7ef64c2817963b9092d0c9"
      ],
      "data": [
        "09f50f11c4d12493691d185fd459f92c"
      ]
    },
    "rack-storage": {
      "instructions": [
        "4324acc4b49bc04129ea1c77ec93fcc2"
      ]
    },
    "rack-storage-top": {
      "instructions": [
        "78c6e71181470ceaf35bc1dbc9f177cc"
      ]
    },
    "secure-parking": {
      "instructions": [
        "b675874b910ab4b2d7d702d3ea84b2c7"
      ]
    }
  },
  "Module": {
    "load-handling": {
      "description": [
        "52bd02cc21148c1692e2a94425702bf7"
      ]
    }
  }
}
