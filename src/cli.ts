#!/usr/bin/env node
import { Command } from 'commander';
import { KeyManager } from './crypto.js';
import { SoWasItClient } from './api-client.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const program = new Command();

program
  .name('signer')
  .description('SoWasIt blockchain signing tool - manage keys and sign blocks')
  .version('0.1.0');

program
  .command('add-key')
  .description('Generate a new key pair and register it with SoWasIt')
  .requiredOption('-t, --token <token>', 'Enrollment token from SoWasIt')
  .requiredOption('-k, --api-key <key>', 'SoWasIt API key')
  .option('-o, --output <dir>', 'Output directory for keys', './keys')
  .option('-n, --name <name>', 'Key pair name', 'sowasit')
  .option('-p, --passphrase <passphrase>', 'Passphrase to encrypt private key (recommended)')
  .option('--base-url <url>', 'SoWasIt API base URL', 'https://api.sowasit.com')
  .option('--client-name <name>', 'Your company name for certification')
  .option('--client-siret <siret>', 'Your company SIRET number')
  .option('--client-contact <contact>', 'Contact email for certification')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔐 Generating new key pair...'));
      
      const keyPair = await KeyManager.generateKeyPair({
        passphrase: options.passphrase
      });

      console.log(chalk.blue('\n📤 Registering public key with SoWasIt...'));
      
      const client = new SoWasItClient({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl
      });

      const response = await client.registerPublicKey({
        enrollmentToken: options.token,
        publicKey: keyPair.publicKey,
        algorithm: 'ECDSA-P256',
        clientInfo: {
          name: options.clientName,
          siret: options.clientSiret,
          contact: options.clientContact
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Registration failed');
      }

      console.log(chalk.green('✓ Public key registered successfully!'));
      console.log(chalk.dim(`  Key ID: ${response.data?.key_id}`));
      console.log(chalk.dim(`  Status: ${response.data?.status}`));

      console.log(chalk.blue('\n💾 Saving key pair locally...'));
      await KeyManager.saveKeyPair(keyPair, options.output, options.name);

      const certPath = path.join(options.output, `${options.name}.certification.txt`);
      if (response.data?.printable_certification) {
        await fs.writeFile(certPath, response.data.printable_certification);
        console.log(chalk.yellow(`\n📄 Certification document saved to: ${certPath}`));
        console.log(chalk.yellow('   Please print, sign, stamp, and upload it to complete the activation.'));
      }

      console.log(chalk.green('\n✅ Done! Your key is ready to use.'));
      
    } catch (error: any) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('sign')
  .description('Sign content with your private key')
  .requiredOption('-k, --key <path>', 'Path to private key file')
  .requiredOption('-d, --data <path>', 'Path to JSON file containing content to sign')
  .option('-p, --passphrase <passphrase>', 'Passphrase for encrypted private key')
  .option('-o, --output <path>', 'Output file for signature (default: stdout)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📖 Reading content...'));
      const contentStr = await fs.readFile(options.data, 'utf-8');
      const content = JSON.parse(contentStr);

      console.log(chalk.blue('🔐 Loading private key...'));
      const privateKey = await KeyManager.loadPrivateKey(options.key, options.passphrase);

      console.log(chalk.blue('✍️  Signing content...'));
      const { signature, algorithm } = KeyManager.signContent(content, privateKey);

      const result = {
        signature,
        algorithm,
        signedAt: new Date().toISOString()
      };

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(chalk.green(`✓ Signature saved to ${options.output}`));
      } else {
        console.log(chalk.green('\n✓ Signature:'));
        console.log(JSON.stringify(result, null, 2));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('create-block')
  .description('Create a signed block on SoWasIt blockchain')
  .requiredOption('-c, --chain <chainId>', 'Chain ID')
  .requiredOption('-k, --key <path>', 'Path to private key file')
  .requiredOption('--api-key <key>', 'SoWasIt API key')
  .requiredOption('--key-id <keyId>', 'Public key ID registered with SoWasIt')
  .option('--content <json>', 'Block content as JSON string')
  .option('--content-file <path>', 'Path to JSON file containing block content')
  .option('-p, --passphrase <passphrase>', 'Passphrase for encrypted private key')
  .option('--base-url <url>', 'SoWasIt API base URL', 'https://api.sowasit.com')
  .action(async (options) => {
    try {
      let content: any;

      if (options.contentFile) {
        console.log(chalk.blue('📖 Reading content from file...'));
        const contentStr = await fs.readFile(options.contentFile, 'utf-8');
        content = JSON.parse(contentStr);
      } else if (options.content) {
        content = JSON.parse(options.content);
      } else {
        throw new Error('Either --content or --content-file must be provided');
      }

      console.log(chalk.blue('🔐 Loading private key...'));
      const privateKeyPem = await fs.readFile(options.key, 'utf-8');

      console.log(chalk.blue('✍️  Signing content...'));
      const { signature } = KeyManager.signContent(content, privateKeyPem, options.passphrase);

      console.log(chalk.blue('📤 Creating signed block...'));
      const client = new SoWasItClient({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl
      });

      const response = await client.createBlock(options.chain, {
        content,
        signature,
        public_key_id: options.keyId
      });

      if (!response.success) {
        throw new Error(response.error || 'Block creation failed');
      }

      console.log(chalk.green('✅ Block created successfully!'));
      console.log(chalk.dim(`  Block ID: ${response.block?.data?.id}`));
      console.log(chalk.dim(`  Hash: ${response.block?.hash?.substring(0, 16)}...`));
      console.log(chalk.dim(`  Signature verified: ✓`));

    } catch (error: any) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();
