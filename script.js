// import {MCP2221} from './module/mcp2221a_web.js'
// import {AARDVARK} from './module/aardvark_web.js'
// import {AARDVARK} from './module/aardvark_node_usb.js'
// let i2c_host_adapter;
let i2c_host_adapter_name;
let connected=false;
const sleep_delay = 10;

document.addEventListener("DOMContentLoaded", async () => {

    // ****************************************
    // I2C Event Listener
    // ****************************************
    // 메뉴 항목에 이벤트 리스너 추가
    // 메뉴 항목 객체화
    let guiLoaded = false;

    const menuItems = {
        connect_aardvark: document.getElementById("menu-connect-aardvark"),
        // connect_mcp2221a: document.getElementById("menu-connect-mcp2221a"),
        // load_ic: document.getElementById("menu-load-IC"),
        // services: document.getElementById("menu-services"),
        contact: document.getElementById("menu-contact"),
    };

    const statusIndicator = document.getElementById("status-indicator");

    // 각 메뉴에 이벤트 리스너 추가
    menuItems.connect_aardvark.addEventListener("click", async () => {
        try {
            if (connected === false) {
                const init_response = await window.usbAPI.init();
                console.log(init_response)
                i2c_host_adapter_name = init_response.productName;
                connected = init_response.connected;
                console.log('connected', connected)
                setConnectionStatus(init_response.connected);
                document.getElementById("menu-connect-aardvark").textContent  = 'Disonnect Aardvark'
                console.log('✅ USB Device Connected:', init_response);
            } else {
                const close_response = await window.usbAPI.close();
                console.log(close_response)
                i2c_host_adapter_name = close_response.productName;
                connected = close_response.connected;
                console.log('connected', connected)
                setConnectionStatus(close_response.connected);
                document.getElementById("menu-connect-aardvark").textContent  = 'Connect Aardvark'
                console.log('✅ USB Device Disconnected:', close_response);

            }


        } catch (error) {
            console.log(`Error during connection`);
            setConnectionStatus(false);
        }
        sidebar.classList.remove("open");
    });
    // menuItems.connect_mcp2221a.addEventListener("click", async () => {

    //     try {
    //         i2c_host_adapter = new MCP2221();
    //         const init_response = await i2c_host_adapter.init();
    //         i2c_host_adapter_name = i2c_host_adapter.device.productName;
    //         // console.log(`${i2c_host_adapter_name} is connected`);
    //         // console.log(init_response.message);
    //         setConnectionStatus(init_response.message.includes('is connected'));
    //     } catch (error) {
    //         console.log(`Error during connection`);
    //         setConnectionStatus(false);
    //     }
    //     sidebar.classList.remove("open");
    // });

    const xmlICName='WPC-to-1S_gui.xml'
    await loadChip(xmlICName);
    guiLoaded = true;

    // 상태 변경 함수
    function setConnectionStatus(status) {

        if (status) {
            statusIndicator.style.backgroundColor = "#5cb85c"; // 초록색으로 변경
            document.getElementById("status-text").textContent = `Aardvark I2C/SPI Host Adapter is connected`
        } else {
            statusIndicator.style.backgroundColor = "#d9534f"; // 빨간색으로 변경
            document.getElementById("status-text").textContent = `Disconnected`;
        };

    };

    document.getElementById('i2c-write').addEventListener('click', async () => {
        const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
        const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
        const data = document.getElementById('i2c-data').value.split(',').map(value => parseInt(value, 16));
        // Implement I2C write using WebHID API
        // console.log(data);
        const i2cWriteData = await window.usbAPI.i2cWrite(slaveAddress, registerAddress, data);
        // console.log(i2cWriteData);
        const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
        logMessage( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
    });

    document.getElementById('i2c-read').addEventListener('click', async () => {
        const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
        const registerAddress = parseInt(document.getElementById('i2c-register-address').value, 16);
        const length = parseInt(document.getElementById('i2c-length').value);
        // Implement I2C read using WebHID/WebUSB API
        // logMessage( 'i2c-read', hexString(slaveAddress), hexString(registerAddress), hexString(length) );
        const i2cReadData = await window.usbAPI.i2cRead(slaveAddress, registerAddress, length);
        if (i2cReadData.success){
            const readLog = Array.from(i2cReadData.data).map(x => hexString(x)).join(', ');
            logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddress), `[${readLog}]`);
        } else {
            logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
        }
    });

    let i2cScripts = [];
    document.getElementById("fileInput").addEventListener("change", function (event) {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;
        logMessage(`File Name: ${selectedFile.name}`);
        const reader = new FileReader();
        // 파일 내용을 텍스트로 읽기
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            const content = e.target.result;
            const lines = content.split('\n');
            // 각 줄이 (0x로 시작하는 hex, 0x로 시작하는 hex) 형식인지 확인
            const isValid = lines.every(line => {
                line = line.trim();
                const regex = /^\(0x[0-9A-Fa-f]+,\s*0x[0-9A-Fa-f]+\)$/;
                return line === '' || regex.test(line);
            });

            if (isValid) {
                logMessage(`File format is correct. Script Echo`);
                lines.forEach(line => {
                    line = line.trim();
                    if (line === '') return;
                    logMessage(`${line}`);
                });
                // 기존 스크립트 초기화 후 새 스크립트 추가
                i2cScripts = [];
                lines.forEach(line => {
                    line = line.trim();
                    // 빈 줄이면 다음 줄로 넘어가기
                    if (line === '') return;
                    // 괄호와 공백을 제거하고, 쉼표로 나누기
                    const [hex1, hex2] = line.replace(/[()]/g, '').split(',').map(s => s.trim());
                    // 객체 형태로 저장
                    i2cScripts.push({ hex1, hex2 });
                });

            } else {
                logMessage("File format is incorrect. Please upload a valid file.");
                logMessage("Example File Format: (0x01, 0xab)");
            }
        };
        // 같은 파일을 다시 로드할 수 있도록 input 값 초기화
        event.target.value = '';
    });

    // 버튼 클릭 시 파일 선택 대화 상자를 열기
    document.getElementById('i2c-load-script').addEventListener('click', () => {
        document.getElementById("fileInput").click();
    });

    // document.getElementById("i2c-run-script").addEventListener("click", function() {
    document.getElementById('i2c-run-script').addEventListener('click', async () => {

        const slaveAddress = parseInt(document.getElementById('i2c-slave-address-script').value, 16);

        for (const pair of i2cScripts) {
            const registerAddress = parseInt(pair.hex1, 16);
            // const data = parseInt(pair.hex2);
            const data = pair.hex2.split(',').map(value => parseInt(value, 16));
            const i2cWriteData = await window.usbAPI.i2cWrite(slaveAddress, registerAddress, data);
            const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
            logMessage( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
        }
    });


    document.getElementById('clear-log').addEventListener('click', async () => {
        clearlogMessage()
    });

    document.getElementById('extract-log').addEventListener('click', async () => {
        extractlogMessage()
    });

    menuItems.contact.addEventListener("click",  async () => {
        alert('inkuk.baek@cirrus.com')
    });

    window.usbAPI.onDeviceMessage((msg) => {
        logMessage(msg)
    });

    window.usbAPI.onConsoleLog((msg) => {
        console.log("[From Backend]", msg);
    });


    // ****************************************
    // gui builder
    // ****************************************
    const guiSection = document.getElementById("section-gui")
    const guiTitleText = document.getElementById("gui-title")


    // menuItems.load_ic.addEventListener("click",  async () => {

    //     if (guiLoaded == false) {
    //         const xmlICName = await chipSelect();
    //         loadChip(xmlICName);
    //         guiLoaded = true;
    //     } else {
    //         while (guiSection.children.length > 1) {

    //             for (const child of guiSection.children) {
    //                 if (child.className == "section-gui") {
    //                     guiSection.removeChild(child)
    //                 }
    //             }
    //         }
    //         guiLoaded = false;
    //         guiTitleText.textContent = `GUI not loaded`
    //     }
    //     // 알림
    //     alert('gui loaded')
    //     sidebar.classList.remove("open");
    // });


    // ****************************************
    // menu button & slide bar Listener
    // ****************************************
    const hamburger = document.getElementById("hamburger");
    const sidebar = document.getElementById("sidebar");

    // 햄버거 버튼 클릭 시 슬라이드바 열고 닫기
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // 슬라이드바 외부를 클릭하면 슬라이드바 닫기
    document.addEventListener("click", (event) => {
      // 클릭한 대상이 슬라이드바나 햄버거 버튼이 아닌 경우
      if (!sidebar.contains(event.target) && !hamburger.contains(event.target)) {
        sidebar.classList.remove("open");
      }
    });
});

async function loadChip(xmlICName) {
    // console.log(xmlICName)
    const guiTitleText = document.getElementById("gui-title");
    const guiSection = document.getElementById("section-gui")
    // alert(`You selected: ${xmlICName}`);
    // XML 파일 로드
    const xmlDoc = await xmlGUIParser(xmlICName);
    // ic name 가져오고 gui title 추가
    const icNameElement = xmlDoc.querySelector("ic-name");
    const icName = icNameElement ? icNameElement.textContent.trim() : null;
    guiTitleText.textContent = `${icName} GUI`
    guiSection.appendChild(guiTitleText)

    const i2cAddrElement = xmlDoc.querySelector("i2c-addr");
    const i2cAddr = i2cAddrElement ? i2cAddrElement.textContent.trim() : null;
    const i2cAddrInput = document.getElementById("i2c-slave-address")
    i2cAddrInput.value = i2cAddr

    // gui 섹션 생성
    const sections = xmlDoc.querySelectorAll("section")
    for (const section of sections) {
        const sectionTitleDiv = document.createElement("div");
        sectionTitleDiv.className = "section-gui";
        const sectionTitleId = section.getAttribute("id")
        sectionTitleDiv.id = `${sectionTitleId}-title`;
        const guiSectionTitle = document.createElement("h3");
        guiSectionTitle.textContent = `${sectionTitleId}`
        sectionTitleDiv.appendChild(guiSectionTitle)

        const sectionDiv = document.createElement("div");
        sectionDiv.className = "section-gui";
        sectionDiv.id = section.getAttribute("id");

        // gui 라인 생성
        const lines = section.querySelectorAll("line");
        for (const line of lines) {
            const lineDiv = document.createElement("div");
            lineDiv.className = "gui-line";
            lineDiv.id = line.getAttribute("id");
            // UI 요소 생성
            const childrenLine = line.childNodes;
            for (const ui of childrenLine) {
                if (ui.tagName === "button") {
                    const buttonElement = document.createElement("button");
                    buttonElement.id = ui.getAttribute("id");
                    // console.log(buttonElement.id)
                    buttonElement.style.width = `${ui.getAttribute("width")}px`; // 너비 설정
                    // <text> 태그의 버튼 이름 설정
                    const buttonText = ui.querySelector("text");
                    if (buttonText) {
                        buttonElement.textContent = buttonText.textContent.trim();
                    }

                    // 명령 파싱
                    const commands = ui.querySelectorAll("command > *"); // 모든 <command>의 자식 명령 태그
                    // console.log("commands", commands)
                    const parsedCommands = parseCommands(commands); // 명령 파싱 함수 호출
                    // 클릭 이벤트에 명령 처리 로직 추가
                    addButtonCommands(buttonElement, parsedCommands);
                    lineDiv.appendChild(buttonElement);

                } else if (ui.tagName === "dropdown") {
                    const dropdownLayout = ui.getAttribute("layout");
                    // console.log(`dropdownLayout ${dropdownLayout}`)
                    const dropdownContainer = document.createElement("div");
                    if (dropdownLayout == "vertical") {
                        dropdownContainer.classList.add("dropdown-container");
                        dropdownContainer.style.width = `${ui.getAttribute("width")}px`; // 너비 설정
                    } else {
                        dropdownContainer.classList.add("dropdown-container-hor");
                        dropdownContainer.style.width = `${1.5*ui.getAttribute("width")}px`; // 너비 설정
                    }

                    const dropdownLabelElement = document.createElement("label");
                    dropdownLabelElement.textContent = ui.querySelector("label-text").textContent;
                    const dropdownElement = document.createElement("select");
                    dropdownElement.id = ui.getAttribute("id");
                    // 드롭다운 옵션 추가
                    const optionLength = ui.querySelectorAll("option").length;
                    const default_value = ui.querySelector("default").textContent;
                    if (ui.querySelectorAll("option").length > 0) {
                        const options = ui.querySelectorAll("option");
                        for (const option of options) {
                            const optionElement = document.createElement("option");
                            optionElement.value = option.getAttribute("value");
                            optionElement.textContent = option.textContent;
                            dropdownElement.appendChild(optionElement);
                        }
                    } else {
                        const optionLSB = Number(ui.querySelector("range-label-lsb").textContent);
                        const optionOffset = Number(ui.querySelector("range-label-offset").textContent);
                        const optionUnit = ui.querySelector("range-label-unit").textContent;
                        const options = createRange(Number(ui.querySelector("range-value-min").textContent), Number(ui.querySelector("range-value-max").textContent));
                        for (const option of options) {
                            const optionElement = document.createElement("option");
                            optionElement.value = option;
                            optionElement.textContent = `${(option * optionLSB + optionOffset).toFixed(3)} ${optionUnit}`;
                            dropdownElement.appendChild(optionElement);
                        }
                    }
                    dropdownElement.value = default_value
                    const commands = ui.querySelectorAll("command > *"); // 모든 <command>의 자식 명령 태그
                    const parsedCommands = parseCommands(commands); // 명령 파싱 함수 호출
                    addDropdownCommands(dropdownElement, parsedCommands);
                    dropdownContainer.appendChild(dropdownLabelElement);
                    dropdownContainer.appendChild(dropdownElement)
                    lineDiv.appendChild(dropdownContainer);

                } else if (ui.tagName === "label") {
                    const labelElement = document.createElement("label");
                    labelElement.style.width = `${ui.getAttribute("width")}px`; // 너비 설정
                    const labelText = ui.querySelector("text");
                    labelElement.textContent = labelText.textContent.trim();
                    lineDiv.appendChild(labelElement);

                } else if (ui.tagName === "checkbox") {
                    const checkboxContainer = document.createElement("div");
                    checkboxContainer.classList.add("checkbox-container");
                    checkboxContainer.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    const checkboxLabel = document.createElement("label");
                    checkboxLabel.textContent = ui.querySelector("text").textContent;

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = ui.getAttribute("id");
                    const commands = ui.querySelectorAll("command > *"); // 모든 <command>의 자식 명령 태그
                    // console.log('commands', commands)
                    const parsedCommands = parseCommands(commands); // 명령 파싱 함수 호출
                    addInputCommands(checkbox, parsedCommands);
                    checkboxContainer.appendChild(checkboxLabel);
                    checkboxContainer.appendChild(checkbox)
                    lineDiv.appendChild(checkboxContainer);
                } else if (ui.tagName === "adc-read") {
                    const idString = ui.getAttribute("id");
                    const adcContainer = document.createElement("div");
                    adcContainer.classList.add("adc-container");
                    adcContainer.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    const adcRawValue = document.createElement("input");
                    adcRawValue.id = idString + "-raw";
                    adcRawValue.value = "-";
                    adcRawValue.readOnly = true;
                    adcRawValue.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    const adcCoefficient = document.createElement("input");
                    adcCoefficient.id = idString + "-coef";
                    const coefText = ui.querySelector("coef");
                    adcCoefficient.value = coefText.textContent.trim();
                    adcCoefficient.readOnly = true
                    adcCoefficient.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    const adcOffset = document.createElement("input");
                    adcOffset.id = idString + "-offset";
                    const offsetText = ui.querySelector("offset");
                    adcOffset.value = offsetText.textContent.trim();
                    adcOffset.readOnly = true
                    adcOffset.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    const adcValue = document.createElement("input");
                    adcValue.id = idString + "-value";
                    adcValue.value = parseInt(adcRawValue.value) * parseFloat(adcCoefficient.value);
                    adcValue.readOnly = true;
                    adcValue.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    adcContainer.appendChild(adcRawValue);
                    adcContainer.appendChild(adcOffset);
                    adcContainer.appendChild(adcCoefficient);
                    adcContainer.appendChild(adcValue)
                    lineDiv.appendChild(adcContainer)

                } else if (ui.tagName === "regfield") {
                    const regContainer = document.createElement("div");
                    regContainer.classList.add("reg-container");
                    regContainer.style.width = `${ui.getAttribute("width")}px`; // 너비 설정

                    const regLabel = document.createElement("label");
                    regLabel.textContent = ui.querySelector("text").textContent;

                    const regValue = document.createElement("input");
                    regValue.value = "-";
                    regValue.id = ui.getAttribute("id");
                    if (ui.getAttribute("readonly")=="true") {
                        regValue.readOnly = true;
                    } else {
                        regValue.readOnly = false;
                    }
                    const commands = ui.querySelectorAll("command > *"); // 모든 <command>의 자식 명령 태그
                    // console.log('commands', commands)
                    const parsedCommands = parseCommands(commands); // 명령 파싱 함수 호출
                    addInputCommands(regValue, parsedCommands);
                    regValue.style.width = `${ui.getAttribute("width")}px`; // 너비 설정
                    regContainer.appendChild(regLabel);
                    regContainer.appendChild(regValue);
                    lineDiv.appendChild(regContainer);
                }

            }
            sectionDiv.appendChild(lineDiv);
        }

        guiSection.appendChild(sectionTitleDiv)
        guiSection.appendChild(sectionDiv)
    }
}

async function chipSelect() {
    const modal = document.getElementById("modal");
    modal.style.display = "block";
    document.body.classList.add("modal-active");

    return new Promise((resolve) => {
        let xmlICName;
        document.querySelectorAll(".modalOption").forEach(option => {
            option.addEventListener("click", event => {
            xmlICName = event.target.textContent+"_gui.xml";

            modal.style.display = "none"; // 모달 닫기
            document.body.classList.remove("modal-active");
            resolve(xmlICName);
            });
        });


    });


}

async function xmlGUIParser(xmlICName) {
    // XML 파일 로드
    try {
        // XML 파일 로드
        // console.log(xmlICName)
        const response = await fetch(xmlICName);
        if (!response.ok) {
            throw new Error("Failed to load XML file");
        }

        // XML 텍스트 읽기
        const xmlText = await response.text();

        // XML 파싱
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        console.log("XML Loaded:", xmlICName); // XML 확인
        return xmlDoc; // XML 반환
    } catch (error) {
        console.error("Error loading XML:", error);
        return null; // 오류 발생 시 null 반환
    }
}


function parseCommands(commands) {
    const parsedCommands = [];

    for (const command of commands) {
        const commandType = command.tagName; // 명령 유형 (예: i2c-write, spi-write 등)
        const commandData = { type: commandType, details: {} };

        if (commandType === "i2c-write") {
            commandData.details.addr = command.querySelector("addr").textContent.trim();
            commandData.details.data = command.querySelector("data")
                ? command.querySelector("data").textContent.trim()
                : null;
        } else if (commandType === "i2c-read") {
            commandData.details.addr = command.querySelector("addr").textContent.trim();
            commandData.details.target = command.querySelectorAll("set-ui");
            // console.log("target", commandData.details.target)

        } else if (commandType === "i2c-update") {
            commandData.details.addr = command.querySelector("addr").textContent.trim();
            commandData.details.bitInfos = command.querySelector("bits").textContent.trim(); // 모든 <bit-info>의 자식 명령 태그
        } else if (commandType === "spi-write") {
            commandData.details.register = command.querySelector("register").textContent.trim();
            commandData.details.value = command.querySelector("value").textContent.trim();
        } else if (commandType === "sleep-ms") {
            commandData.details.duration = command.querySelector("duration").textContent.trim();
        } else if (commandType === "adc-read") {
            commandData.details.addr_msb = command.querySelector("addr-msb").textContent.trim();
            commandData.details.addr_msb_positions = command.querySelector("addr-msb-position").textContent.trim().split(",").map(Number);
            commandData.details.addr_msb_shift = parseInt(command.querySelector("addr-msb-shift").textContent.trim());

            commandData.details.addr_lsb = command.querySelector("addr-lsb").textContent.trim();
            commandData.details.addr_lsb_positions = command.querySelector("addr-lsb-position").textContent.trim().split(",").map(Number);
            commandData.details.addr_lsb_shift = parseInt(command.querySelector("addr-lsb-shift").textContent.trim());

            commandData.details.target = command.querySelectorAll("set-ui");
            if (command.querySelector("addr-post")) {
                commandData.details.addr_post = command.querySelector("addr-post").textContent.trim();
            } else {
                commandData.details.addr_post = null;
            }
        } else if (commandType == "mode-config"){
            commandData.details.data = null
            commandData.details.name = command.querySelector("name").textContent.trim();
        } else if (commandType == "lb-control"){
            commandData.details.data = null
            commandData.details.name = command.querySelector("name").textContent.trim();
        } else if (commandType =='i2c-slave') {
            commandData.details.addr = command.textContent.trim();
        } else if (commandType == "ldo-config"){
            commandData.details.data = command.textContent.trim();
        }
        else {
            console.warn(`Unknown command type: ${commandType}`);
            commandData.details = null;
        }
        parsedCommands.push(commandData);
    }
    return parsedCommands;
}

async function addButtonCommands(buttonElement, parsedCommands) {
    // console.log('addButtonCommands');
    // console.log(parsedCommands);
    buttonElement.addEventListener("click", async () => {
        // console.log(`Button ${buttonElement.id} clicked!`);

        for (const [index, command] of parsedCommands.entries()) {
            // console.log(`Command ${index + 1} -> Type: ${command.type}`);
            if (command.type == 'i2c-write') {
                await i2cWriteCommand(command);

            } else if (command.type == 'i2c-read') {
                // console.log(`command.details.target ${command.details.target}`);
                const i2cReadData = await i2cReadCommand(command);
                const i2cReadDataArr = splitToBits(i2cReadData);
                // console.log(`i2cReadData: ${i2cReadData} ${splitToBits(i2cReadData)}`)
                // console.log(`command.details.target ${command.details.target}`)
                for (const target_ui of command.details.target) {
                    // console.log(`target_ui ${target_ui}`)
                    const ui_id = target_ui.querySelector("id").textContent;
                    const bits = target_ui.querySelector("bits").textContent;
                    const bit_arr = bits.split(",").map(Number);
                    // console.log(`target_ui id ${ui_id}`);
                    // console.log(`target_ui bits ${bits}`);
                    // console.log(`bit_arr ${bit_arr[0]}`);
                    let ui_value ="";
                    for (const bit_num of bit_arr) {
                        ui_value += i2cReadDataArr[bit_num];
                        // console.log(`i2cReadDataArr[bit_num] ${i2cReadDataArr[bit_num]}`)
                        // console.log(`[bit_num] ${bit_num}`)
                    }
                    console.log(`ui_value ${ui_value}`)
                    const uiElement = document.getElementById(ui_id);
                    // console.log(uiElement)
                    // console.log(uiElement.type)
                    if (uiElement.type == "text") {
                        uiElement.value = ui_value;
                    } else if (uiElement.type == "checkbox") {
                        uiElement.checked = Boolean(parseInt(ui_value));
                    } else if (uiElement.type == "select-one") {
                        uiElement.value = parseInt(ui_value, 2);
                    }

                }
            } else if (command.type == 'i2c-update') {
                // console.log('command', command)
                await i2cUpdateCommand(command, command.value);
            } else if (command.type == 'adc-read') {
                // console.log(`command.details.target ${command.details.target}`);
                const adcReadDataRaw = await adcReadCommand(command);
                // console.log('target', command.details.target[0])
                const ui_id = command.details.target[0].querySelector("id").textContent;
                const rawUIID= ui_id + "-raw";
                const valueUIID= ui_id + "-value";
                const coefUIID= ui_id + "-coef";
                const offsetUIID= ui_id + "-offset";
                const rawUI = document.getElementById(rawUIID);
                const valueUI = document.getElementById(valueUIID);
                const coefUI = document.getElementById(coefUIID);
                const offsetUI = document.getElementById(offsetUIID);

                // console.log(`command.details.addr_post ${command.details.addr_post}`)
                const adcPostName = command.details.addr_post
                // console.log(`adcPostName ${adcPostName}`)

                const adcReadData = Number(offsetUI.value) + Number(coefUI.value) * adcReadDataRaw;

                rawUI.value = adcReadDataRaw;
                if (adcPostName) {
                    const adcReadDataPost = await postProcessMap[adcPostName](adcReadData);
                    // console.log(`adcReadDataRaw ${adcReadDataRaw}, adcReadData ${adcReadData}, adcReadDataPost ${adcReadDataPost}, coef ${coefUI.value} offset ${offsetUI.value}`)
                    valueUI.value = adcReadDataPost.toFixed(3);
                } else {
                    // console.log(`adcReadDataRaw ${adcReadDataRaw}, adcReadData ${adcReadData}, coef ${coefUI.value} offset ${offsetUI.value}`)
                    valueUI.value = adcReadData.toFixed(3);
                }

            } else if (command.type =="i2c-slave") {
                await i2cSlaveAddrCommand(command)
            } else if (command.type == "ldo-config") {
                await ldoConfigCommand(command.details.data)
            }

            // if (command.details) {
            //     console.log("Details:", command.details);
            // }
        };
    });
}

async function addDropdownCommands(selectElement, parsedCommands) {
    selectElement.addEventListener("change", async (event) => {
        const selectedValue = event.target.value; // 선택된 값

        for (const [index, command] of parsedCommands.entries()) {
            if (command.type == "i2c-write") {
                await i2cWriteCommand(command);
                await sleep(sleep_delay)
            } else if (command.type =="i2c-update") {
                const binLength = command.details.bitInfos.split(",").length
                await i2cUpdateCommand(command, selectedValue);
            } else if (command.type == "mode-config") {
                if (command.details.name == "LN8620")
                    await modeConfigLN8620(selectedValue)
            } else if (command.type == "lb-control") {
                if (command.details.name == "LN8620")
                    await lbEnable(selectedValue);
            } else if (command.type =="i2c-slave") {
                await i2cSlaveAddrCommand(command)
            }
        }
    });
}

async function addInputCommands(inputElement, parsedCommands) {
    inputElement.addEventListener("change", async (event) => {
        let inputValue;
        if (inputElement.type == "text") {
            inputValue = event.target.value; // 선택된 값
        } else if (inputElement.type == "checkbox") {
            // console.log(`event.target.checked ${event.target.checked}`)
            inputValue = Number(event.target.checked)
        }

        // console.log(`Input ${inputElement.id} changed!`);
        // console.log(`Changed Value: ${inputValue}`);
        // console.log(`parsedCommands ${parsedCommands}`)

        for (const [index, command] of parsedCommands.entries()) {

            // console.log(`Command ${index + 1} -> Type: ${command.type}`);
            // console.log("Details:", command.details, "Value:", inputValue);

            if (command.type == "i2c-update") {
                await i2cUpdateCommand(command, inputValue);
            } else if (command.type =="i2c-slave") {
                await i2cSlaveAddrCommand(command)
            }

                // 실제 실행 로직 추가
        }
    });
}

async function ldoConfigCommand(state) {
    if (state === 'on') {
        window.usbAPI.power5VOn();
    } else if (state === 'off') {
        window.usbAPI.power5VOff();
    } else {
        throw new Error('❌ Unknown LDO state');
    }
}

async function i2cWriteCommand(command, read_back=true) {
    await sleep(sleep_delay)
    if (!connected) {
        logMessage('No i2c_host_adapter connected')
        console.log('No i2c_host_adapter connected')
    } else {
        const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
        const registerAddress = parseInt(command.details.addr, 16);
        const data = command.details.data.split(',').map(value => parseInt(value, 16));
        const i2cWriteData = await window.usbAPI.i2cWrite(slaveAddress, registerAddress, data,read_back);
        const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
        logMessage( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
        // console.log( `${i2c_host_adapter_name} - WRITE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`);
    }
}


/**
 * i2c read with command set
 * @param {Object} command
 * @param {string} command.type
 * @param {Object} command.details
 * @param {string} command.details.addr
 */
async function i2cReadCommand(command) {
    await sleep(10)
    if (!connected) {
        logMessage('No i2c_host_adapter connected')
        console.log('No i2c_host_adapter connected')
    } else {
        const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
        // console.log(command)
        const registerAddress = parseInt(command.details.addr, 16);
        // console.log("registerAddress", registerAddress, hexString(registerAddress))
        const length = 1
        const i2cReadData = await window.usbAPI.i2cRead(slaveAddress, registerAddress, length);
        await sleep(sleep_delay);
        if (i2cReadData.success){
            const readLog = Array.from(i2cReadData.data).map(x => hexString(x)).join(', ');
            logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddress), `[${readLog}]`);
            // console.log( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddress), `[${readLog}]`);
            return i2cReadData.data
        } else {
            logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
            // console.log(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
        }
    }
}

async function adcReadCommand(command) {
    // console.log('adcReadCommand')
    if (!connected) {
        logMessage('No i2c_host_adapter connected')
        // console.log('No i2c_host_adapter connected')
    } else {
        // console.log(command)
        const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);

        const registerAddressMSB = parseInt(command.details.addr_msb, 16);
        const positionsMSB = command.details.addr_msb_positions;
        const shiftMSB = command.details.addr_msb_shift;

        const registerAddressLSB = parseInt(command.details.addr_lsb, 16);
        const positionsLSB = command.details.addr_lsb_positions;
        const shiftLSB = command.details.addr_lsb_shift;

        // console.log(`registerAddressMSB ${registerAddressMSB} registerAddressLSB ${registerAddressLSB}`)
        const length = 1
        await sleep(sleep_delay);
        const adcReadDataMSB = await window.usbAPI.i2cRead(slaveAddress, registerAddressMSB, length);
        await sleep(sleep_delay);
        const adcReadDataLSB = await window.usbAPI.i2cRead(slaveAddress, registerAddressLSB, length);


        if (adcReadDataMSB.success){
            const readLog = Array.from(adcReadDataMSB.data).map(x => hexString(x)).join(', ');
            logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddressMSB), `[${readLog}]`);
            // console.log( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddressMSB), `[${readLog}]`);
        } else {
            logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
            // console.log(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
        }
        if (adcReadDataLSB.success){
            const readLog = Array.from(adcReadDataLSB.data).map(x => hexString(x)).join(', ');
            logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddressLSB), `[${readLog}]`);
            // console.log( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddressLSB), `[${readLog}]`);
        } else {
            logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
            // console.log(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
        }

        // console.log(`adcReadDataMSB adcReadDataLSB ${adcReadDataMSB.data} ${adcReadDataLSB.data} ${Number(adcReadDataMSB.data).toString(2).padStart(8,0)} ${Number(adcReadDataLSB.data).toString(2).padStart(8,0)}`)

        const adcReadRaw = extractBits(adcReadDataMSB.data, positionsMSB, shiftMSB) + extractBits(adcReadDataLSB.data, positionsLSB, shiftLSB);
        // console.log(`adcReadRaw ${adcReadRaw}`)
        await sleep(sleep_delay);

        return adcReadRaw

    }
}

async function i2cSlaveAddrCommand(command) {
    const i2c_slave_addr = document.getElementById('i2c-slave-address')
    i2c_slave_addr.value = command.details.addr;

}

async function i2cUpdateCommand(command, value, read_back=true) {
    await sleep(sleep_delay)
    if (!connected) {
        logMessage('No i2c_host_adapter connected')
        console.log('No i2c_host_adapter connected')
    } else {
        const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
        const registerAddress = parseInt(command.details.addr, 16);
        // const bitInfos = command.details.bitInfos.split(",");
        // console.log('bitInfos', bitInfos)
        const bitPositions = command.details.bitInfos.split(",").map(s => parseInt(s, 10)).sort((a, b) => a - b);
        const bitValues = intToBitArray(Number(value), bitPositions.length)
        const updateInfo = Array(8).fill("x");
        for (let i = 0; i < bitPositions.length; i++) {
            const pos = bitPositions[i];
            const val = bitValues[i];
            if (pos >= 0 && pos < 8) {
                updateInfo[pos] = val;
            }
        }
        // console.log(`updateInfo ${updateInfo}`);
        // logMessage('bitPositions', bitPositions, 'bitValues', bitValues);
        // const i2cWriteData = await i2c_host_adapter.i2cUpdateByte(slaveAddress, registerAddress, bitInfos, alignedBits);
        const i2cWriteData = await window.usbAPI.i2cUpdateByte(slaveAddress, registerAddress, bitPositions, bitValues, read_back=read_back);
        const writeLog = Array.from(i2cWriteData.data).map(x => hexString(x)).join(', ');
        logMessage( `${i2c_host_adapter_name} - UPDATE:`, hexString(slaveAddress), hexString(registerAddress), `[${writeLog}]`, `[${updateInfo.reverse()}]`);
    };
};


function hexString(num) {
    return num.toString(16).toUpperCase().padStart(4, '0x')
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function splitToBits(number) {
    const bits = [];
    for (let i = 7; i >= 0; i--) {
      bits.push((number >> i) & 1); // i번째 비트를 추출
    }
    bits.reverse();
    return bits;
};

function extractBits(inputNum, positions, shift) {
    // console.log('extractBits');

    const intNum = parseInt(inputNum);
    // console.log(`inputNum ${inputNum}, ${typeof inputNum} bin ${inputNum.toString(2)} intNum ${intNum} ${typeof intNum}`)
    // console.log(`positions ${positions}`);
    // console.log(`shift ${shift} ${typeof shift}`);
    let result = 0;
    for (let i = 0; i < positions.length; i++) {
        const bitPos = positions[i]; // 현재 비트 위치
        const bit = (intNum >> bitPos) & 1; // 비트 추출
        result |= (bit << (positions.length - 1 - i)); // 비트를 결과값의 올바른 위치로 이동하여 병합
    }
    result = result << shift;
    // console.log(`result ${result}, ${result.toString(2)} ${typeof result}`);
    return result
};

function createRange(start, end) {
    const arr = [];
    for (let i = start; i <= end; i++) {
      arr.push(i);
    }
    return arr;
};

function logMessage(...messages) {
    const log = document.getElementById('log');
    const combinedMessage = messages.join(' ')
    const timestamp = new Date().toLocaleTimeString('en-US');
    log.textContent += `[${timestamp}] ${combinedMessage}\n`;
    log.scrollTop = log.scrollHeight; // Scroll to the bottom
};

function extractlogMessage() {
    const log = document.getElementById('log');
    const logText = "data:text/csv;charset=utf-8,"+log.textContent;
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/:/g, '');

    const fileName = `log_dump_${timestamp}.csv`;
    let encodedUri = encodeURI(logText);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    // 다운로드 링크를 클릭해서 파일 다운로드를 트리거
    document.body.appendChild(link); // 필요한 경우에만 추가
    link.click();
    document.body.removeChild(link); // 클릭 후 링크 제거
};

function clearlogMessage() {
    const log = document.getElementById('log');
    log.textContent = '';
    log.scrollTop = log.scrollHeight; // Scroll to the bottom
};

const postProcessMap = {
    LN1608IINADC: postProcessLN1608IINADC,
}


async function postProcessLN1608IINADC(iinAdcPre) {
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
    const registerAddressPost = 49;
    const length = 1;
    const gainArray = [0, 1, 2, 3, 4, 5, 6, 7, -8, -7, -6, -5, -4, -3, -2, -1]
    await sleep(10);
    const postGainReg = await window.usbAPI.i2cRead(slaveAddress, registerAddressPost, length);
    if (postGainReg.success){
        const readLog = Array.from(postGainReg.data).map(x => hexString(x)).join(', ');
        logMessage( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddressPost), `[${readLog}]`);
        // console.log( `${i2c_host_adapter_name} - READ: `, hexString(slaveAddress), hexString(registerAddressPost), `[${readLog}]`);
    } else {
        logMessage(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
        // console.log(`${i2c_host_adapter_name} - READ:  Failed, reconnect device`);
    }
    const postGainRegVal = postGainReg.data;
    const postGainIndex = postGainRegVal >> 4;
    const postGain = gainArray[postGainIndex];
    const iinAdcPreOffset = 0.9;
    const iinAdcOffset = (iinAdcPre - iinAdcPreOffset)*(postGain/100);
    const iinAdcPost = iinAdcPre + iinAdcOffset;
    // console.log(`postGainRegVal ${postGainRegVal} postGainIndex ${postGainIndex} iinAdcPre ${iinAdcPre} iinAdcPost ${iinAdcPost}`)

    return iinAdcPost
};

const lionkey_en = {
    type:'i2c-write',
    details:{
        addr: "0x30",
        data: "0xAA"
    }
}
const lionkey_dis = {
    type:'i2c-write',
    details:{
        addr: "0x30",
        data: "0x00"
    }
}

const operationMode = {
    details: {
        addr: "0x1D",
        bitInfos: "1,0",
        data: 0
}}
const standby_en = {
    type:'i2c-update',
    details:{
        addr: "0x1F",
        bitInfos: "0",
        data: 1
    }
}
const standby_dis = {
    type:'i2c-update',
    details:{
        addr: "0x1F",
        bitInfos: "0",
        data: 0
    }
}
const tm_track_cfg = {
    type:'i2c-update',
    details:{
        addr: "0x2E",
        bitInfos: "6,5",
        data: 0
    }
}
const select_ext_5v_for_vdr = { details: {
    addr: "0x1F",
    bitInfos: "3",
    data: 0
}}
const select_ext_5v_ungate_en = { details: {
    addr: "0x2A",
    bitInfos: "2",
    data: 0
}}

const lb_en = { details: {
    addr: "0x26",
    bitInfos: "0",
    data: 0
}}
const rev_iin_det = { details: {
    addr: "0x1E",
    bitInfos: "2",
    data: 0
}}
const disable_ldo = {
    type:'i2c-update',
    details:{
        addr: "0x1F",
        bitInfos: "5",
        data: 1
    }
}
const iin_oc = 4
const iin_oc_cfg = { details: {
    addr: "0x20",
    bitInfos: "6,5,4,3,2,1,0",
    data: Math.min(Math.floor(20 * iin_oc), 127)
}}
const iin_low_cfg = { details: {
    addr: "0x1E",
    bitInfos: "7,6,5,4",
    data: 0
}}
const fsw_cfg_fine = { details: {
    addr: "0x31",
    bitInfos: "7,6,5,4",
    data: 8
}}
const infet_out_switch_ok_cfg = { details: {
    addr: "0x22",
    bitInfos: "6,5,4",
    data: 5
    //  0,   1,   2,   3,   4,   5,   6,   7
    // 8V, 10V, 12V, 14V, 16V, 18V, 20V, 22V
}}
const force_infet_ctrl = { details: {
    addr: "0x4B",
    bitInfos: "3",
    data: 1
}}

const disable_iin_ocp = { details: {
    addr: "0x23",
    bitInfos: "2",
    data: 1
}}

const iin_rev_isns_en = { details: {
    addr: "0x20",
    bitInfos: "7",
    data: 0
}}

const infet_off_det_en = { details: {
    addr: "0x40",
    bitInfos: "6",
    data: 0
}}

const vin_short_en = { details: {
    addr: "0x21",
    bitInfos: "3",
    data: 0
}}

const vin_ov_en = { details: {
    addr: "0x21",
    bitInfos: "2",
    data: 0
}}

const tm_infet_cp_clk_low_freq_en = { details: {
    addr: "0x4B",
    bitInfos: "2",
    data: 1
}}
const tm_infet_cp_en = { details: {
    addr: "0x4B",
    bitInfos: "1",
    data: 0
}}

const tm_infet_short_en = { details: {
    addr: "0x4B",
    bitInfos: "0",
    data: 0
}}

const tm_infet_setting = { details: {
    addr: "0x4B",
    bitInfos: "2,1,0",
    data: 4
}}


async function enterStandby() {
    await i2cWriteCommand(lionkey_en);

    await i2cUpdateCommand(operationMode, 0);
    await i2cUpdateCommand(standby_en, 1);
    await i2cUpdateCommand(tm_track_cfg, 3);
    await i2cUpdateCommand(select_ext_5v_for_vdr, 0);
    await i2cUpdateCommand(select_ext_5v_ungate_en, 0);
    await i2cUpdateCommand(lb_en, 0);

    await i2cWriteCommand(lionkey_dis);
}

async function enterSW62() {
    const chip_revision = extractBitfield(
        await i2cReadCommand({type:"i2c-read",details: {addr:"0x52"}}),
        7, 4 );
    const product_cfg = extractBitfield(
        await i2cReadCommand({type:"i2c-read", details: {addr:"0x31"}}),
        3, 0 )

    await i2cWriteCommand(lionkey_en);

    await callFromModeMatrix("sw_62");

    await i2cUpdateCommand(rev_iin_det, 0);
    await lbEnable(false);
    await i2cUpdateCommand(disable_ldo, 0);

    const iin_oc = 4
    await i2cUpdateCommand(iin_oc_cfg, Math.min(Math.floor(20 * iin_oc), 127));
    const iin_low = 0;
    await i2cUpdateCommand(iin_low_cfg, iin_low);
    const fsw_cfg = 8;
    await i2cUpdateCommand(fsw_cfg_fine, fsw_cfg);
    const infet_out_switch_ok = 5
    await i2cUpdateCommand(infet_out_switch_ok_cfg, infet_out_switch_ok);

    if (product_cfg == 2) {
        await i2cUpdateCommand(force_infet_ctrl, 2);
        await i2cUpdateCommand(disable_iin_ocp, 1);
        await i2cUpdateCommand(iin_rev_isns_en, 0);
        await i2cUpdateCommand(infet_off_det_en, 0);
        await i2cUpdateCommand(rev_iin_det, 0);
    }

    if (chip_revision < 3) {
        await i2cUpdateCommand(vin_short_en, 0);
        await i2cUpdateCommand(vin_ov_en, 0);
    }

    await ln8620_workaround();

    await i2cUpdateCommand(standby_en, 0);
    if (chip_revision < 3) {
        await i2cUpdateCommand(vin_ov_en, 1);
    }
    if (product_cfg == 2) {
        await i2cUpdateCommand(force_infet_ctrl, 1);
        await i2cUpdateCommand(tm_infet_setting, 4);
    }

    await i2cWriteCommand(lionkey_dis);

}

async function enterBypass22() {
    const chip_revision = extractBitfield(
        await i2cReadCommand({type:"i2c-read",details: {addr:"0x52"}}),
        7, 4 );
    const product_cfg = extractBitfield(
        await i2cReadCommand({type:"i2c-read", details: {addr:"0x31"}}),
        3, 0 )


    try {
        await i2cWriteCommand(lionkey_en);

        await callFromModeMatrix("bypass_22");

        await i2cUpdateCommand(rev_iin_det, 0);
        // await lbEnable(false);
        const iin_oc = 1
        await i2cUpdateCommand(iin_oc_cfg, Math.min(Math.floor(20 * iin_oc), 127));
        const iin_low = 0;
        await i2cUpdateCommand(iin_low_cfg, iin_low);
        await i2cUpdateCommand(disable_ldo, 0);

        // const fsw_cfg = 8;
        // await i2cUpdateCommand(fsw_cfg_fine, fsw_cfg);
        // const infet_out_switch_ok = 5
        // await i2cUpdateCommand(infet_out_switch_ok_cfg, infet_out_switch_ok);

        if (product_cfg == 2) {
            await i2cUpdateCommand(force_infet_ctrl, 0);
            await i2cUpdateCommand(disable_iin_ocp, 1);
            await i2cUpdateCommand(iin_rev_isns_en, 0);
            await i2cUpdateCommand(infet_off_det_en, 0);
            await i2cUpdateCommand(rev_iin_det, 0);
        }

        if (chip_revision < 3) {
            await i2cUpdateCommand(vin_short_en, 0);
        }

        await ln8620_workaround();

        await i2cUpdateCommand(standby_en, 0);

        if (chip_revision < 3 && product_cfg !==2) {
            await i2cUpdateCommand(vin_short_en, 1);
        }
        if (product_cfg == 2) {
            await i2cUpdateCommand(force_infet_ctrl, 1);
            await i2cUpdateCommand(tm_infet_setting, 0);
        }

        await i2cWriteCommand(lionkey_dis);

    } catch (err) {
        console.log('Mode Change(bypass) failed', err.message);
        throw err
    }



}

async function callFromModeMatrix(mode) {
    // const modeNames = {
    //     0: "standby",
    //     1: "bypass_22",
    //     2: "sw_62",
    //     3: "sw_42",
    // }
    const modeConfigs = {
        "bypass_22": {
            "DISABLE_IIN_OCP": 0,
            "DISABLE_LDO": 0,
            "DISABLE_VIN_SHORT_AUTO": 0,
            "IIN_LOW_CFG": 6,
            "IIN_OC_CFG": 104,
            "IIN_OC_SHDN_CFG": 3,
            "IIN_REV_ISNS_EN": 0,
            "INFET_OFF_DET_CFG": 4,
            "INFET_OFF_DET_EN": 1,
            "INFET_OFF_DET_SHDN_CFG": 3,
            "INFET_OUT_SWITCH_OK_CFG": 0,
            "INFET_OUT_SWITCH_OK_EN": 0,
            "OPERATION_MODE": 1,
            "OV_DELTA": 0,
            "PRECHARGE_SC_OUT_SHORT_CHECK": 1,
            "REVERSE_MODE": 0,
            "SC_OUT_OV_CFG": 3,
            "SC_OUT_OV_EN": 0,
            "SC_OUT_OV_SHDN_CFG": 3,
            "SC_OUT_SWITCH_OK_EN": 1,
            "SC_OUT_UV_CFG": 3,
            "SC_OUT_UV_EN": 0,
            "SYSGPIO_SHDN_CFG": 3,
            "TEMP_MAX_EN": 1,
            "TEMP_MAX_SHDN_CFG": 3,
            "TM_SC_OUT_PRECHARGE_CFG": 0,
            "TM_TRACK_CFG": 0,
            "TM_VIN_OV_CFG": 0,
            "UV_DELTA": 0,
            "VIN_OV_EN": 1,
            "VIN_OV_TRACK_EN": 1,
            "VIN_OV_TRACK_SHDN_CFG": 3,
            "VIN_SHORT_EN": 1,
            "VIN_SHORT_SHDN_CFG": 0,
            "VIN_UV_EN": 1,
            "VIN_UV_TRACK_EN": 1,
            "VIN_UV_TRACK_SHDN_CFG": 3
        },
        "sw_62": {
            "DISABLE_IIN_OCP": 0,
            "DISABLE_LDO": 0,
            "DISABLE_VIN_SHORT_AUTO": 0,
            "IIN_LOW_CFG": 6,
            "IIN_OC_CFG": 40,
            "IIN_OC_SHDN_CFG": 3,
            "IIN_REV_ISNS_EN": 0,
            "INFET_OFF_DET_CFG": 4,
            "INFET_OFF_DET_EN": 1,
            "INFET_OFF_DET_SHDN_CFG": 3,
            "INFET_OUT_SWITCH_OK_CFG": 5,
            "INFET_OUT_SWITCH_OK_EN": 1,
            "OPERATION_MODE": 3,
            "OV_DELTA": 1,
            "PRECHARGE_SC_OUT_SHORT_CHECK": 1,
            "REVERSE_MODE": 0,
            "SC_OUT_OV_CFG": 3,
            "SC_OUT_OV_EN": 0,
            "SC_OUT_OV_SHDN_CFG": 3,
            "SC_OUT_SWITCH_OK_EN": 1,
            "SC_OUT_UV_CFG": 3,
            "SC_OUT_UV_EN": 0,
            "SYSGPIO_SHDN_CFG": 3,
            "TEMP_MAX_EN": 1,
            "TEMP_MAX_SHDN_CFG": 3,
            "TM_SC_OUT_PRECHARGE_CFG": 3,
            "TM_TRACK_CFG": 3,
            "TM_VIN_OV_CFG": 7,
            "UV_DELTA": 0,
            "VIN_OV_EN": 1,
            "VIN_OV_TRACK_EN": 1,
            "VIN_OV_TRACK_SHDN_CFG": 3,
            "VIN_SHORT_EN": 1,
            "VIN_SHORT_SHDN_CFG": 0,
            "VIN_UV_EN": 1,
            "VIN_UV_TRACK_EN": 1,
            "VIN_UV_TRACK_SHDN_CFG": 3
        }
    }
    const modeConfigAddr = {
        "DISABLE_IIN_OCP": {
                "addr": '0x23',
                "bits": "2"
        },
        "DISABLE_LDO": {
            "addr": '0x1F',
            "bits": "5"
        },
        "DISABLE_VIN_SHORT_AUTO": {
            "addr": '0x41',
            "bits": "2"
        },
        "IIN_LOW_CFG": {
            "addr": '0x1E',
            "bits": "7,6,5,4"
        },
        "IIN_OC_CFG": {
            "addr": '0x20',
            "bits": "6,5,4,3,2,1,0"
        },
        "IIN_OC_SHDN_CFG": {
            "addr": '0x27',
            "bits": "3,2"
        },
        "IIN_REV_ISNS_EN": {
            "addr": '0x20',
            "bits": "7"
        },
        "INFET_OFF_DET_CFG": {
            "addr": '0x40',
            "bits": "6,5,4"
        },
        "INFET_OFF_DET_EN": {
            "addr": '0x40',
            "bits": "6"
        },
        "INFET_OFF_DET_SHDN_CFG": {
            "addr": '0x27',
            "bits": "7,6"
        },
        "INFET_OUT_SWITCH_OK_CFG": {
            "addr": '0x22',
            "bits": "6,5,4"
        },
        "INFET_OUT_SWITCH_OK_EN": {
            "addr": '0x22',
            "bits": "7"
        },
        "OPERATION_MODE": {
            "addr": '0x1D',
            "bits": "1,0"
        },
        "OV_DELTA": {
            "addr": '0x22',
            "bits": "1,0"
        },
        "PRECHARGE_SC_OUT_SHORT_CHECK": {
            "addr": '0x1F',
            "bits": "6"
        },
        "REVERSE_MODE": {
            "addr": '0x1D',
            "bits": "4"
        },
        "SC_OUT_OV_CFG": {
            "addr": '0x29',
            "bits": "2,1,0"
        },
        "SC_OUT_OV_EN": {
            "addr": '0x29',
            "bits": "3"
        },
        "SC_OUT_OV_SHDN_CFG": {
            "addr": '0x27',
            "bits": "6"
        },
        "SC_OUT_SWITCH_OK_EN": {
            "addr": '0x3C',
            "bits": "7"
        },
        "SC_OUT_UV_CFG": {
            "addr": '0x3C',
            "bits": "1,0"
        },
        "SC_OUT_UV_EN": {
            "addr": '0x3C',
            "bits": "4"
        },
        "SYSGPIO_SHDN_CFG": {
            "addr": '0x28',
            "bits": "6"
        },
        "TEMP_MAX_EN": {
            "addr": '0x1E',
            "bits": "3"
        },
        "TEMP_MAX_SHDN_CFG": {
            "addr": '0x28',
            "bits": "7,6"
        },
        "TM_SC_OUT_PRECHARGE_CFG": {
            "addr": '0x2E',
            "bits": "4,3"
        },
        "TM_TRACK_CFG": {
            "addr": '0x2E',
            "bits": "6,5"
        },
        "TM_VIN_OV_CFG": {
            "addr": '0x2E',
            "bits": "2,1,0"
        },
        "UV_DELTA": {
            "addr": '0x22',
            "bits": "3,2"
        },
        "VIN_OV_EN": {
            "addr": '0x21',
            "bits": "2"
        },
        "VIN_OV_TRACK_EN": {
            "addr": '0x21',
            "bits": "1"
        },
        "VIN_OV_TRACK_SHDN_CFG": {
            "addr": '0x28',
            "bits": "1,0"
        },
        "VIN_SHORT_EN": {
            "addr": '0x21',
            "bits": "3"
        },
        "VIN_SHORT_SHDN_CFG": {
            "addr": '0x27',
            "bits": "1,0"
        },
        "VIN_UV_EN": {
            "addr": '0x21',
            "bits": "4"
        },
        "VIN_UV_TRACK_EN": {
            "addr": '0x21',
            "bits": "0"
        },
        "VIN_UV_TRACK_SHDN_CFG": {
            "addr": '0x28',
            "bits": "3,2"
        }
    }
    // const modeConfigName = modeNames[mode];
    const modeConfig = modeConfigs[mode];
    // console.log('mode', mode)
    // console.log('modeConfigName',modeConfigName)
    // console.log('modeConfig',modeConfig)

    for (const [regName, value] of Object.entries(modeConfig)) {
        const command = {
            type:'i2c-update',
            details:{
                addr: modeConfigAddr[regName].addr,
                bitInfos: modeConfigAddr[regName].bits,
                data: value
            }
        }

        await i2cUpdateCommand(command, value)

    }
}

async function modeConfigLN8620(mode) {
    // mode = 0, idle
    // mode = 1, bypass
    // mode = 2, sw_62
    // mode = 3, sw_42

    if (mode == 0) {
        await enterStandby();
    } else if (mode == 1) {
        await enterBypass22();
    } else if (mode == 2) {
        await enterSW62();
    }
    const slaveAddress = parseInt(document.getElementById('i2c-slave-address').value, 16);
};


/**
 * 비트필드 추출 함수
 * @param {number} value - 8비트 정수
 * @param {number} msb - 상위 비트 위치 (예: 7)
 * @param {number} lsb - 하위 비트 위치 (예: 5)
 * @returns {number} - 추출된 비트필드 값 (우측 정렬됨)
 */
function extractBitfield(value, msb, lsb) {
    const width = msb - lsb + 1;
    const mask = (1 << width) - 1;
    return (value >> lsb) & mask;
  }

async function lbEnable(enable) {

    const lb_en_0 = { details: {
        addr: "0x26",
        bitInfos: "0",
        data: 0
    }}
    const lb_en_1 = { details: {
        addr: "0x26",
        bitInfos: "0",
        data: 1
    }}
    const lb_min_freq_en_0 = { details: {
        addr: "0x26",
        bitInfos: "2",
        data: 0
    }}
    const lb_min_freq_en_1 = { details: {
        addr: "0x26",
        bitInfos: "2",
        data: 1
    }}
    const select_ext_5v_for_vdr_0 = { details: {
        addr: "0x1F",
        bitInfos: "3",
        data: 0
    }}
    const select_ext_5v_for_vdr_1 = { details: {
        addr: "0x1F",
        bitInfos: "3",
        data: 1
    }}
    const infet_cp_force_clk_high_freq_0 = { details: {
        addr: "0x41",
        bitInfos: "3",
        data: 0
    }}
    const infet_cp_force_clk_high_freq_1 = { details: {
        addr: "0x41",
        bitInfos: "3",
        data: 1
    }}
    if (Boolean(Number(enable))){
        await setDisOvl(4)
        await i2cUpdateCommand(lb_en_1, lb_en_1.details.data)
        await i2cUpdateCommand(lb_min_freq_en_1, lb_min_freq_en_1.details.data)
        // await i2cUpdateCommand(select_ext_5v_for_vdr_1, select_ext_5v_for_vdr_1.details.data)
        // await i2cUpdateCommand(infet_cp_force_clk_high_freq_0, infet_cp_force_clk_high_freq_0.details.data)

    } else {
        await setDisOvl(4)
        await i2cUpdateCommand(lb_en_0, lb_en_0.details.data)
        await i2cUpdateCommand(lb_min_freq_en_0, lb_min_freq_en_0.details.data)

        // await i2cUpdateCommand(select_ext_5v_for_vdr_0, select_ext_5v_for_vdr_0.details.data)
        // await i2cUpdateCommand(infet_cp_force_clk_high_freq_1, infet_cp_force_clk_high_freq_1.details.data)
    }

}

async function setDisOvl(setting) {
    if (setting < 0 || setting > 7) throw new Error("입력은 3비트 숫자 (0~7) 여야 합니다.");

    const setting6bit = (setting << 3) | setting

    const disovl_b_c = { details: {
        addr: "0x3A",
        bitInfos: "3",
        data: setting6bit
    }}
    const disovl_d_e = { details: {
        addr: "0x3B",
        bitInfos: "3",
        data: setting6bit
    }}
    const disovl_f_g = { details: {
        addr: "0x3C",
        bitInfos: "3",
        data: setting6bit
    }}
    const disovl_h_i = { details: {
        addr: "0x3E",
        bitInfos: "3",
        data: setting6bit
    }}

    await i2cWriteCommand(lionkey_en);
    await i2cUpdateCommand(disovl_b_c, disovl_b_c.details.data)
    await i2cUpdateCommand(disovl_d_e, disovl_d_e.details.data)
    await i2cUpdateCommand(disovl_f_g, disovl_f_g.details.data)
    await i2cUpdateCommand(disovl_h_i, disovl_h_i.details.data)

}

async function ln8620_workaround() {
    const workAround = {
        "0x58": {
            "addr": '0x58',
            "data": "0x3F"
        },
        "0x59": {
            "addr": '0x59',
            "data": "0x51"
        },
        "0x5A": {
            "addr": '0x5A',
            "data": "0x19"
        },
        "0x5B": {
            "addr": '0x5B',
            "data": "0x02"
        },
        "SC_OUT_PRECHARGE_EN_TIME_CFG": {
            "addr": '0x23',
            "bits": "2",
            "data": "1"
        },
        "SW4_BEFORE_BSTH_BSTL_EN_CFG": {
            "addr": '0x2A',
            "bits": "6",
            "data": "1"
        },
        "BSTH_BSTL_HIGH_ROUT_CFG": {
            "addr": '0x40',
            "bits": "7,6",
            "data": "0"
        },
        "SW1_VGS_SHORT_EN_MSK": {
            "addr": '0x40',
            "bits": "3",
            "data": "0"
        },
    }
    for (const [regName, value] of Object.entries(workAround)) {
        await sleep(sleep_delay);
        if (value.bits){
            const command = {
                type:'i2c-update',
                details:{
                    addr: value.addr,
                    bitInfos: value.bits,
                    data: value.data
                }
            }
            await i2cUpdateCommand(command, value.data)
        } else {
            const command = {
                type:'i2c-write',
                details:{
                    addr: value.addr,
                    data: value.data
                }
            }
            await i2cWriteCommand(command)
        }

    }
}


/**
 * 정수를 n비트 배열로 변환 (LSB가 인덱스 0)
 * @param {number} value - 정수 입력값
 * @param {number} n - 비트 수
 * @returns {number[]} - LSB 우선 배열 (0과 1)
 */
function intToBitArray(value, n) {
    const binStr = value.toString(2).padStart(n, "0"); // 2진 문자열
    return [...binStr].reverse().map(bit => parseInt(bit, 10));
  }