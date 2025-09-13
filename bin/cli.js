#!/usr/bin/env node
import dotenv from 'dotenv';
import {main} from '../src/index.js';

dotenv.config({ silent: true });
console.log(`_ _ _ _ _ _ _ _ _ _ _ _ _\n
Usage:
    downtube   //and have fun\n`)
main(process.argv);