import { HardhatUserConfig } from "hardhat/config";

import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@nomiclabs/hardhat-ethers";
import "@matterlabs/hardhat-zksync-verify";

// import "@matterlabs/zksync-contracts";
// hardhat.config.ts
// import "@openzeppelin/contracts";
// import "@openzeppelin/contracts-upgradeable";
// import "@openzeppelin/hardhat-upgrades";
/* import "@openzeppelin/hardhat-upgrades"; <- results in
    TypeError: Cannot convert undefined or null to object
      at Function.keys (<anonymous>)
      at extractLinkReferences (/Users/otu/Desktop/demo/node_modules/@openzeppelin/upgrades-core/src/link-refs.ts:14:31)
    */


// dynamically changes endpoints for local tests
export const zkSyncTestnet =
    process.env.NODE_ENV == "test"
        ? {
            url: "http://127.0.0.1:8011",
            ethNetwork: "http://127.0.0.1:8045",
            zksync: true,
        }
        : {
            url: "https://testnet.era.zksync.dev",
            ethNetwork: "goerli",
            zksync: true,
            gas: 5000000,
            gasPrice: 50000000000,
            // contract verification endpoint
            verifyURL:
                "https://zksync2-testnet-explorer.zksync.dev/contract_verification",
        };

const config: HardhatUserConfig = {
    zksolc: {
        version: "latest",
        settings: {
            libraries: {
                "contracts/util/SignatureChecker.sol": {
                    "SignatureChecker": "0x6Cf0138D1cDD4955C52591da2481696184E0398e"
                }
            }
        },
    },
    defaultNetwork: "zkSyncTestnet",
    networks: {
        hardhat: {
            zksync: false,
        },
        zkSyncTestnet,
    },
    solidity: {
        version: "0.6.12",
    },
};

export default config;
