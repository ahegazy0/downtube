#!/usr/bin/env node
import dotenv from 'dotenv';
import {main} from '../src/index.js';

dotenv.config();

main(process.argv);