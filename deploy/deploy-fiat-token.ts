import { Wallet, Provider } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const proxyAdminAddress = process.env.PROXY_ADMIN_ADDRESS || "0xf8ddcb44218538d21cd282092e7ed83d8a86a714";
const ownerAddress = process.env.OWNER_ADDRESS || "0x5dd42f8011476c5996a1e51dbc8c7846f088bd9d";
const masterMinterOwnerAddress = process.env.MASTER_MINTER_OWNER_ADDRESS || "0x11ee238abd4e5f16336057ae88ddee4d440c5559";
const tokenName = process.env.TOKEN_NAME || "USDC";
const tokenSymbol = process.env.TOKEN_SYMBOL || "USDC";
const tokenCurrency = process.env.TOKEN_CURRENCY || "USD";
const tokenDecimals = process.env.TOKEN_DECIMAL || 6;
let fiatTokenImplementationAddress = "";
let pauserAddress = "";
let blacklisterAddress = "";
let lostAndFoundAddress = "";

if (!PRIVATE_KEY || !proxyAdminAddress || !ownerAddress || !masterMinterOwnerAddress) {
    throw new Error(
        "PROXY_ADMIN_ADDRESS, OWNER_ADDRESS, MASTERMINTER_OWNER_ADDRESS, and PRIVATE_KEY must be provided in .env"
    );
}

if (!pauserAddress || !blacklisterAddress || !lostAndFoundAddress) {
    if (process.env.NODE_ENV === "mainnet") {
        throw new Error(
            "PAUSER_ADDRESS, BLACKLISTER_ADDRESS and LOST_AND_FOUND_ADDRESS must be provided in config.js"
        );
    } else {
        // If we're not on mainnet, let the user values dictate this.
        pauserAddress = pauserAddress || proxyAdminAddress;
        blacklisterAddress = blacklisterAddress || proxyAdminAddress;
        lostAndFoundAddress = lostAndFoundAddress || proxyAdminAddress;
    }
}

console.log(`Proxy Admin:                        ${proxyAdminAddress}`);
console.log(`Owner:                              ${ownerAddress}`);
console.log(`Pauser:                             ${pauserAddress}`);
console.log(`Blacklister:                        ${blacklisterAddress}`);
console.log(`Lost and Found:                     ${lostAndFoundAddress}`);
console.log(
    `Master Minter Owner:                ${masterMinterOwnerAddress}`
);
console.log(
    `FiatTokenV2_2ImplementationAddress: ${fiatTokenImplementationAddress}`
);

export default async function (hre: HardhatRuntimeEnvironment) {

    const { ethers } = hre;
    const wallet = new Wallet(PRIVATE_KEY);

    // 1_initial Migration
    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);

    console.log("Loading Migrations artifact...");
    const Migration = await deployer.loadArtifact("Migrations");
    console.log("Deploying Migration...");
    await deployer.deploy(Migration);

    // 2_deploy_implementation_and_proxy
    console.log("Loading MasterMinter artifact...");
    const MasterMinter = await deployer.loadArtifact("MasterMinter");
    console.log("Loading FiatTokenV2_2 artifact...");
    const fiatTokenV2_2Artifact = await deployer.loadArtifact("FiatTokenV2_2");
    console.log("Loading FiatTokenProxy artifact...");
    const fiatTokenProxyArtifact = await deployer.loadArtifact("FiatTokenProxy");

    // Initialize the provider
    const provider = new Provider(hre.userConfig.networks.zkSyncTestnet.url);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Deploying FiatTokenV2_2...");
    const fiatTokenV2_2 = await deployer.deploy(fiatTokenV2_2Artifact);
    console.log("Deployed fiat token v2.2 contract at", fiatTokenV2_2.address);

    console.log("Deploying FiatTokenProxy...");
    const fiatTokenProxy = await deployer.deploy(fiatTokenProxyArtifact, [fiatTokenV2_2.address]);
    console.log("Deployed proxy contract at", fiatTokenProxy.address);

    // Now that the proxy contract has been deployed, we can deploy the master minter.
    console.log("Deploying master minter...");
    const masterMinter = await deployer.deploy(MasterMinter, [fiatTokenProxy.address]);
    const masterMinterContract = await masterMinter.deployed();
    console.log("Deployed master minter at", masterMinterContract.address);

    // Change the master minter to be owned by the permanent owner
    console.log("Reassigning master minter owner...");
    await masterMinter.transferOwnership(masterMinterOwnerAddress);

    // Now that the master minter is set up, we can go back to setting up the proxy and
    // implementation contracts.

    console.log("Reassigning proxy contract admin...");
    // need to change admin first, or the call to initialize won't work
    // since admin can only call methods in the proxy, and not forwarded methods
    await fiatTokenProxy.changeAdmin(proxyAdminAddress);

    console.log("Initializing proxy contract...");
    const proxyAsV2_2 = await hre.ethers.getContractAtFromArtifact(fiatTokenV2_2Artifact, fiatTokenProxy.address, signer);
    await proxyAsV2_2.connect(signer).initialize(
      tokenName,
      tokenSymbol,
      tokenCurrency,
      tokenDecimals,
      masterMinterOwnerAddress,
      pauserAddress,
      blacklisterAddress,
      ownerAddress
    );

    // Do the V2 initialization
    console.log("Initializing V2...");
    await proxyAsV2_2.connect(signer).initializeV2(tokenName);

    // Do the V2_1 initialization
    console.log("Initializing V2.1...");
    await proxyAsV2_2.connect(signer).initializeV2_1(lostAndFoundAddress);

    // Do the V2_2 initialization
    console.log("Initializing V2.2...");
    await proxyAsV2_2.connect(signer).initializeV2_2([], tokenSymbol);

    console.log("Deployment step 2 finished");
}
