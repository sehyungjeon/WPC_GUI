// export let mcp;

// aardvark_node_usb.js
const usb = require('usb');
const sleep_delay = 10;
const { ipcMain } = require('electron');

class AARDVARK {
    constructor() {
        this.device = null;
        this.i2c_dev_addr = 0x78;
        this.interfaceNumber = null;
        this.endpointIn = null;
        this.endpointOut = null;
    }

    async init() {
        const vendorId = 0x0403;
        const productId = 0xE0D0;
        try {
            // search USB device
            const found = usb.getDeviceList().find(dev => {
                return dev.deviceDescriptor.idVendor === vendorId &&
                       dev.deviceDescriptor.idProduct === productId;
            });
            if (!found) {
                throw new Error(`❌ USB device (VID=${VID}, PID=${PID}) not found`);
            }

            this.device = found
            // console.log('✅ USB Device found:', this.device.deviceDescriptor);
            // open device
            this.device.open();

            const iProduct = this.device.deviceDescriptor.iProduct;
            this.device.productName = await new Promise((resolve, reject) => {
                this.device.getStringDescriptor(iProduct, (err, str) => {
                if (err) reject(err);
                else resolve(str);
                });
            });
            console.log('✅ USB Device found:', this.device.productName);
            consoleLog('✅ USB Device found:', this.device.productName);
            // claim interface
            const iface = this.device.interfaces[0];
            this.interfaceNumber = iface.interfaceNumber;
            // iface.claim();

            // endpoint
            const alt = iface.altSetting || iface;
            // console.log(alt.endpoints)
            for (const endpoint of alt.endpoints) {
                if (endpoint.direction === 'in') {
                    this.endpointIn = endpoint;
                    console.log('📥 IN endpoint:', endpoint.address);
                    consoleLog('📥 IN endpoint:', endpoint.address);
                } else if (endpoint.direction === 'out') {
                    this.endpointOut = endpoint;
                    console.log('📤 OUT endpoint:', endpoint.address);
                    consoleLog('📤 OUT endpoint:', endpoint.address);
                }
            }

            if (!this.endpointIn || !this.endpointOut) {
                throw new Error('❌ USB endpoint configuration failed');
            }

            const response = {
                message: `${this.device.productName} is connected`,
                productName: this.device.productName,
                connected: true
            }
            await this.claimInterface(this.interfaceNumber);
            return response;

        } catch (error) {
            throw new Error(error);
        }
    }

    async close() {
        await this.releaseInterface(this.interfaceNumber);
        this.device.close();
        const response = {
            message: `${this.device.productName} is disconnected`,
            productName: this.device.productName,
            connected: false
        }
        return response;
    }

    async transferOut(endpointNumber, data) {
        const buffer = Buffer.from(data);
        return new Promise((resolve, reject) => {
            this.endpointOut.transfer(buffer, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async transferIn(endpointNumber, length) {
        return new Promise((resolve, reject) => {
            this.endpointIn.transfer(length, (err, data) => {
                if (err) reject(err);
                else resolve({ data });
            });
        });
    }

    // node-usb 기반 메서드들
    async releaseInterface(interfaceNumber) {
        if (!this.device) throw new Error('❌ No device found.');
        const iface = this.device.interfaces[interfaceNumber];

        return new Promise((resolve, reject) => {
        iface.release(true, (err) => {
            if (err) {
            console.error('❌ Failed to release USB interface:', err);
            consoleLog('❌ Failed to release USB interface:', err);
            reject(err);
            } else {
            console.log(`🔓 USB interface ${interfaceNumber} released`);
            consoleLog(`🔓 USB interface ${interfaceNumber} released`);
            resolve();
            }
        });
        });
    }

    async claimInterface(interfaceNumber) {
        if (!this.device) throw new Error('❌ No device found.');
        const iface = this.device.interfaces[interfaceNumber];
        iface.claim();
        console.log(`🔐 USB interface ${interfaceNumber} claimed`);
        consoleLog(`🔐 USB interface ${interfaceNumber} claimed`);
    }

    async power5VOn() {
        // try {
        //     await this.claimInterface(this.interfaceNumber);
        // }
        // catch (error) {
        //     console.error("Error during claimInterface:", error);
        //     return {"addr":i2c_reg_addr, "data":data, "success":false};;
        // }
        await this.transferOut(this.endpointOut, new Uint8Array([0x25, 0x01, 0x13]));    // 5V 켜기
        // await this.releaseInterface(this.interfaceNumber);
        const response = {message:`5V LDO ON`}
        return response
    }
    async power5VOff() {
        // try {
        //     await this.claimInterface(this.interfaceNumber);
        // }
        // catch (error) {
        //     console.error("Error during claimInterface:", error);
        //     return {"addr":i2c_reg_addr, "data":data, "success":false};;
        // }
        await this.transferOut(this.endpointOut, new Uint8Array([0x25, 0x01, 0x03]));    // 5V 켜기
        // await this.releaseInterface(this.interfaceNumber);
        const response = {message:`5V LDO Off`}
        return response
    }

    /**
     *
     * @param {number} i2c_slave_addr
     * @param {number} i2c_reg_addr
     * @param {number[]} data
     * @param {boolean} read_back
     * @returns {object}    result of i2c read operation
     * @returns {number}    return.addr - register address
     * @returns {number[]}  return.data - array of write data
     * @returns {boolean}   return.success - communication success or not
     */
    async i2cWrite(i2c_dev_addr, i2c_reg_addr, data, read_back=false) {
        // await this.i2cCancel();
        // await sleep(sleep_delay);
        let response;
        this.i2c_dev_addr = parseInt(i2c_dev_addr/2);

        const write_command_0 = [0x49, 0x04, this.i2c_dev_addr, 0x00, data.length+1, 0x00];
        const write_command_1 = [0x69, data.length+1, i2c_reg_addr];
        write_command_1.push(...data);

        // try {
        //     await this.claimInterface(this.interfaceNumber);
        // }
        // catch (error) {
        //     console.error("Error during claimInterface:", error);
        //     return {"addr":i2c_reg_addr, "data":data, "success":false};;
        // }

        try {
            this.transferOut(this.endpointOut, new Uint8Array(write_command_0));
            this.transferOut(this.endpointOut, new Uint8Array(write_command_1));
            await sleep(sleep_delay);
            const write_success = true;
            response = {"addr":i2c_reg_addr, "data":data, "success":write_success};
            // this.releaseInterface(this.interfaceNumber);
            if (read_back) {
                const response_read = await this.i2cRead(i2c_dev_addr, i2c_reg_addr);
                const written_value = response_read.data;
                if (written_value[0] !== data[0]) {
                    response = {"addr":i2c_reg_addr, "data":data, "success":false};
                    consoleLog(`i2cWrite read_back failed, write data=${data}, read back=${written_value}`)
                    throw new Error(`i2cWrite read_back failed, write data=${data}, read back=${written_value}`)
                    // console.log('i2cWrite read_back failed',written_value[0].toString(16), response)

                } else {
                    consoleLog('i2cWrite read_back ok', written_value[0].toString(16), data[0].toString(16))
                }
            }

        }
        catch (error) {
            // this.releaseInterface(this.interfaceNumber);
            console.error("Error during communication:", error);
            consoleLog("Error during communication:", error);
        }
        await sleep(sleep_delay);
        return response;
    }
    /**
     *
     * @param {number} i2c_slave_addr
     * @param {number} i2c_reg_addr
     * @param {number} i2c_length
     * @returns {object}    result of i2c read operation
     * @returns {number}    return.addr - register address
     * @returns {number[]}  return.data - array of read data
     * @returns {boolean}   return.success - communication success or not
     */
    async i2cRead(i2c_dev_addr, i2c_reg_addr, i2c_length=1) {
        // await sleep(25);
        let response;
        this.i2c_dev_addr = parseInt(i2c_dev_addr/2);
        const reg_addr = i2c_reg_addr;
        const read_command_0 = [0x49, 0x06, this.i2c_dev_addr, 0x00, 0x01, 0x08, 0x00, i2c_length];
        const read_command_1 = [0x69, 0x01, i2c_reg_addr];
        // try {
        //     await this.claimInterface(this.interfaceNumber);
        // }
        // catch (error) {
        //     console.error("Error during claimInterface:", error);
        //     return {"addr":i2c_reg_addr, "success":false};;
        // }

        await this.transferOut(this.endpointOut, new Uint8Array(read_command_0));
        await this.transferOut(this.endpointOut, new Uint8Array(read_command_1));

        try {
            const maxRetries = 10;
            let retries = 0;
            let data_idx = -1;
            let data_arr = new Uint8Array();
            while (retries < maxRetries) {
                const read_data = await this.transferIn(this.endpointIn, 32); // 1번 엔드포인트에서 32바이트 읽기
                const read_data_slice = new Uint8Array(read_data.data.buffer.slice(2));
                const data_arr_temp = Array.from(data_arr)
                data_arr_temp.push(...Array.from(read_data_slice))
                data_arr = new Uint8Array(data_arr_temp);
                data_idx = findSequence(data_arr, [82, 1, 0, 114, i2c_length]);
                if (data_idx !== -1) {
                    break;
                }
                sleep(sleep_delay)
                retries++;
            }
            const read_success = true;
            const r_data = data_arr.slice(data_idx+5, data_idx+5+i2c_length);
            response = {"addr":reg_addr, "data":r_data, "success":read_success};

        } catch (error) {
            // await this.releaseInterface(this.interfaceNumber)
            console.error("Error during communication:", error);
            consoleLog("Error during communication:", error);
        }

        // await this.releaseInterface(this.interfaceNumber)
        await sleep(sleep_delay);
        return response
    }

    /**
     *
     * @param {number} i2c_slave_addr
     * @param {number} i2c_reg_addr
     * @param {number[]} bitPositions
     * @param {number[]} bitValues
     * @param {boolean} read_back
     * @returns {object}    result of i2c read operation
     * @returns {number}    return.addr - register address
     * @returns {number[]}  return.data - array of read data
     * @returns {boolean}   return.success - communication success or not
     */
    async i2cUpdateByte(i2c_slave_addr, i2c_reg_addr, bitPositions, bitValues, read_back=false) {
        const response_read = await this.i2cRead(i2c_slave_addr, i2c_reg_addr);
        if (!response_read.success) {
            logMessage('i2cUpdateByte: Read Error');
            consoleLog('i2cUpdateByte: Read Error');
            throw new Error('i2cUpdateByte: Write Error')
        }
        const written_value = response_read.data
        const update_value = await this.updateBits(written_value, bitPositions, bitValues);
        const response_write = await this.i2cWrite(i2c_slave_addr, i2c_reg_addr, [update_value], read_back);
        if (!response_write.success) {
            logMessage('i2cUpdateByte: Write Error');
            consoleLog('i2cUpdateByte: Write Error');
            throw new Error('i2cUpdateByte: Write Error')
        }
        return response_write
    }


    updateBits(number, bitPositions, bitValues) {
        // console.log('updateBits')
        // console.log(bitPositions)
        for (let i = 0; i < bitPositions.length; i++) {
            let bitPosition = bitPositions[i];
            let bitValue = bitValues[i];

            if (bitValue === 1) {
                number |= (1 << bitPosition);
            } else if (bitValue === 0) {
                number &= ~(1 << bitPosition)
            }
        }
        // console.log('updateBits number', number)
        return number
    }

    async init_state() {

        // i2c init by set STATUS_SET_PARAM
        const i2c_speed_hz = 400000
        const i2c_speed_value = ((12000000 / i2c_speed_hz) - 3)
        const i2c_speed_command = [...Array(MCP2221.PACKET_SIZE).fill(0)];
        i2c_speed_command[MCP2221.CMD_BYTE] = MCP2221.STATUS_SET_PARAM;
        i2c_speed_command[MCP2221.I2C_SPEED_SET_BYTE] = MCP2221.I2C_SPEED_SET;
        i2c_speed_command[MCP2221.I2C_SPEED_BYTE] = i2c_speed_value;
        try {
            const receivedData = await this.sendAndReceive(i2c_speed_command);
            // console.log("Final received data:", receivedData);
            } catch (error) {
                console.error("Error during communication:", error);
                consoleLog("Error during communication:", error);
                throw new Error(error);
            }

        this.dev_addr = 0xb0
    }

    async toggleGpioPin(pin) {
        const pin_states = await this.gpioGetPins()
        let toggled_state;
        if (pin_states[pin]) {
            toggled_state = 0;
        } else {
            toggled_state = 1;
        }

        const newState = await this.gpioSetPin(pin, toggled_state)
        console.log('toggleGpioPin', 'newState', newState)
        consoleLog('toggleGpioPin', 'newState', newState)
        return newState
    }

    async gpioSetPin(pin, state) {
        if (state) {
            state = 1;
        } else {
            state = 0;
        }
        const byte_address_shift = 4;
        const param = [...new Array(4*4).fill(0)]
        param[pin*byte_address_shift] = 0x01 // alter output state
        param[pin*byte_address_shift+1] = state // output state
        // param[pin+2] = 0x00 // alter direction - do not alter direction ( alter == 1)
        // param[pin+3] = 0x00 // output direction - don't care ( 0x00: output, 0x01 or any other value: input)
        const command = this.makeWritePacket(MCP2221.SET_GP, [0x00, ...param]);
        try {
            const receivedData = await this.sendAndReceive(command);
            // console.log("Final received data:", receivedData);
            return state
        } catch (error) {
            console.error("Error during communication:", error);
            consoleLog("Error during communication:", error);
            throw new Error(error);
        }
    }

    async gpioGetPins() {
        const get_gp_command = this.makeWritePacket(MCP2221.GET_GP);
        try {
            const receivedData = await this.sendAndReceive(get_gp_command);
            // console.log("Final received data:", receivedData);
            if (receivedData[1] == 0) {
                // decode gpio direction from response for future use.
                const gp_direction = [
                    receivedData[MCP2221.GET_GP0_DIRECTION_BYTE],
                    receivedData[MCP2221.GET_GP1_DIRECTION_BYTE],
                    receivedData[MCP2221.GET_GP2_DIRECTION_BYTE],
                    receivedData[MCP2221.GET_GP3_DIRECTION_BYTE]
                    ];
                // decode gpio status from response.
                const gp_status = [
                    receivedData[MCP2221.GET_GP0_VALUE_BYTE],
                    receivedData[MCP2221.GET_GP1_VALUE_BYTE],
                    receivedData[MCP2221.GET_GP2_VALUE_BYTE],
                    receivedData[MCP2221.GET_GP3_VALUE_BYTE]
                    ];

                    return gp_status;
                }

            else {
                console.error("MCP Error: byte 1 is not 0");
                consoleLog("MCP Error: byte 1 is not 0");
                throw new Error("MCP Error: byte 1 is not 0")
            }

        } catch (error) {
            console.error("Error during communication:", error);
            throw new Error(error)
        }
    }







    async i2cCancel() {
        const param = [MCP2221.I2C_CANCEL]
        const command = this.makeWritePacket(MCP2221.STATUS_SET_PARAM, [0x00, ...param])
        try {
            const receivedData = await this.sendAndReceive(command);
            // console.log("Final received data:", receivedData);
            return receivedData
        } catch (error) {
            console.error("Error during communication:", error);
        }
    }

    async reset() {
        const param = [MCP2221.MCP_RESET_1, MCP2221.MCP_RESET_2, MCP2221.MCP_RESET_3]
        const command = this.makeWritePacket(MCP2221.MCP_RESET_0, [...param])
        const reportId = 0
        await this.device.sendReport(reportId, new Uint8Array(command))
        logMessage('MCP2221A is now reset')
        await sleep(1)
    }

    async i2cWriteNoStop(address, length) {


    }

    async i2cReadRepeatedStart(address, length) {


    }

    async i2cReadData(address, length) {


    }

    async i2cSearchSlaveAddress(candidates=[]) {
        // read register address 0x00 with all given slave address
        // if read success without error, then save slave address with 8bit W format
        let i2c_slave_addr_found = [];
        candidates = Array.from( {length:0x77-0x08+1}, (_, i) => i+0x08);
        console.log(candidates);
        if (candidates.length === 0) {
            // no input search full range with general I2C address (7-bit address)
            candidates = Array.from( {length:0x77-0x08}, (_, i) => i+0x08);
        }

        for (let i = 0; i < candidates.length; i++) {
            const address_7bit = candidates[i];
            const address_8bit = address_7bit*2;

            const read = await this.i2cRead(address_8bit, 0x00, 1);
            if (read.success) {
                i2c_slave_addr_found.push(address_8bit)
            }
        }
        logMessage(`Found I2C ADDR: [${Array.from(i2c_slave_addr_found).map(x => x.toString(16).toUpperCase().padStart(4, '0x')).join(', ')}]`);
        return i2c_slave_addr_found
    }

  }

  function logMessage(...messages) {
    // const log = document.getElementById('log');
    const combinedMessage = messages.join(' ')
    const timestamp = new Date().toLocaleTimeString();
    // log.textContent += `[${timestamp}] ${combinedMessage}\n`;
    // log.scrollTop = log.scrollHeight; // Scroll to the bottom

    ipcMain.emit('get-msg-from-device', null, `[${combinedMessage}\n`);
  }

  function consoleLog(...messages) {
    ipcMain.emit('get-console-msg-from-device', null, messages);
  }

  function hexString(num) {
      return num.toString(16).toUpperCase().padStart(4, '0x')
  }

  function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }

  function findSequence(arr, sequence) {
    const seqLength = sequence.length;

    for (let i = 0; i <= arr.length - seqLength; i++) {
        let found = true;

        for (let j = 0; j < seqLength; j++) {
            if (arr[i + j] !== sequence[j]) {
                found = false;
                break;
            }
        }

        if (found) {
            return i; // 첫 번째 매칭된 시퀀스의 시작 인덱스 반환
        }
    }

    return -1; // 시퀀스를 찾지 못한 경우
}

module.exports = AARDVARK;