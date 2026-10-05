// Fingerprints of the stock values earlier releases gave built-in rows, per
// table (Course and Skill by id, Module by slug), row and field. Written by
// scripts/recordStockHistory.js; read by prisma/seed.js through
// src/lib/stockHistory.js, which moves a field still holding one of them to
// the current stock. Do not edit by hand.
export const STOCK_RELEASES = ["7b5763c","c94072f","134b86d","feb6e3b","3fbe0f9","1bcbea8"]

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
        "a0cde765061707fe90c558c5d34a8f30",
        "1d4ab7d4a075655c2918e55300364cec"
      ],
      "instructions": [
        "4b5f057ae01d9251519166aa9a68d086",
        "f410c2788c1fed9c51b7ccf43c7995e1"
      ],
      "hint": [
        "4293f81d8360d3021e5a6fc7e164ccc1",
        "7f48a7741ad929a449fd80880fedaa6d"
      ],
      "data": [
        "aebcfa8a4aa1fa86356006978215855b"
      ]
    },
    "defect-recognition": {
      "objective": [
        "352d9938cdc1a07855cb1991abdd9426"
      ],
      "instructions": [
        "4df8025c61649409a1079292aa9a650a"
      ],
      "hint": [
        "9a56639dc4e461dd3ba8b2eead75ef98"
      ],
      "data": [
        "8887863e9e2346f9649670cd18a841a0"
      ]
    },
    "driving-course": {
      "objective": [
        "88f429719fa408bc750ea52ca9f9b5c9"
      ],
      "instructions": [
        "00ec2f2aa792c238538a06e4f670cbe8"
      ],
      "hint": [
        "f4cb9eb534a870926f6b005949464f16"
      ],
      "data": [
        "7b63148dcfe6737870706562c6311ed5"
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
        "1e7026c7f20eca63372c0a0be175077d",
        "7488ceb012e2809bb23d67fc387af592"
      ],
      "instructions": [
        "213e11c5988bd7b1acf9d63e82db626d"
      ]
    },
    "load-handling-summary": {
      "instructions": [
        "af5e9532a111264a5363e9310e384198"
      ]
    },
    "load-limits": {
      "instructions": [
        "10d7cacbf1ab6d83709b088a85fbedf6",
        "aad3f1cf29eca3b9141930abfb7906a3"
      ],
      "data": [
        "10296be1745c6d4378181a76bc300a66"
      ],
      "hint": [
        "aa7fdf77c2ddcbc8b061e48e1c217109"
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
      ],
      "objective": [
        "e47a80026a01234a670faa9f0466ed15"
      ],
      "instructions": [
        "f746280f4cd8e37450e448b6ce97a2da"
      ],
      "content": [
        "a279eac0eb388c24128e56747fa8bfbd"
      ]
    },
    "pallet-testing-summary": {
      "instructions": [
        "7177a55062edc9948e974f15cdc81cab"
      ],
      "hint": [
        "4956237f604e220c5267ceb98ba4456c"
      ],
      "content": [
        "65f67883a5afe6b0a6ca1b45b0352884"
      ]
    },
    "parallel-parking": {
      "instructions": [
        "336a621bcacef10f7e81facc4f52688c"
      ]
    },
    "post-operation-briefing": {
      "content": [
        "2a437fc3c5567772232b3a29f8c30116",
        "68739ed233685ead3d9593f67568bf16"
      ]
    },
    "precision-carry": {
      "instructions": [
        "403d50d35cb9d17117ad4fdaef7697ef",
        "fdace079247d363f1a6b3bcfedf782ec"
      ],
      "hint": [
        "7ea89f782e7ef64c2817963b9092d0c9",
        "4e3371a3a6f8af50397f7ec3b790fa2c"
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
      ],
      "hint": [
        "ac4c0260cf1fd84901672a173ec0fe16"
      ]
    }
  },
  "Module": {
    "load-handling": {
      "description": [
        "52bd02cc21148c1692e2a94425702bf7",
        "199436f02286b9b4e40b27bfafda5a50"
      ]
    },
    "pallet-testing": {
      "description": [
        "eb6111e9d1bc29dec41ec466165686aa"
      ]
    }
  },
  "Skill": {
    "carry-stack-load": {
      "description": [
        "3c8f2929a53eda901666d8c73bd94148"
      ],
      "evidence": [
        "f3f156dda1513dfa8e5fc74584dfdfd1",
        "6552e739a02259c1d1f5ead71b7d6bc2"
      ]
    },
    "load-chart": {
      "evidence": [
        "bcd34ec81c2e04df8526bdbdae50c5a6"
      ]
    },
    "spatial-awareness": {
      "evidence": [
        "838e18034fc20fe3506839f4d452f760"
      ]
    },
    "travel-safely": {
      "evidence": [
        "1427fcf68363f75e1e588c7a9c2224f6",
        "8c32708452c1e140c3a14f7f033a7b1f"
      ]
    }
  }
}
