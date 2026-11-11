
equipmentmqttPlatform Integration Agreement
Jasta device mqtt Platform docking protocol - English version

Basic format Basic format
ask request
JSON{ "sn": 1, //Command serial number    "method": "face.get", //Request method    "account": "", //Current user account    "password": "", //Current user password, password[1~8]Number of digitsYou can choose not to set it.    "mac": "112233445566", //equipmentMacaddress    "params": {...} //Request data}Note:
The equipment is for eachmqttAll requests must be approved.account, passwordVerify user identity; only authorized users can control the device.
Each command package can not exceed [number].250K

answer
JSON{ "sn": 1, //Current request packet sequence number,The response sequence number must match the request.    "method": "face.get", //Request method    "mac": "112233445566", "data": {...}}Protocol detailed error codes
0:success
1:fail
2Invalid user
3Invalid password
4Invalid command
5On-site data entry timed out
6No restrictions
7:  Entering on-site data entry mode (card, face, fingerprint on-site data entry command returned).
8Errors such as "Data not found" or "No records found" or "No personnel data found" indicate that no data can be found for retrieving records or retrieving personnel data.
9Invalid parameter
10Maximum settings3There are more than one administrator.3personal
     11:No-face algorithm
     12:No face detected
     13:Facial feature extraction failed
     14:Failed to save face image
15:Invalid facial features
16:Facial feature saving failed

Getmqttaddress
To achieve integration with the platformmqttCommunication first requires...httpProtocol Acquisition PlatformmqttRelated informationhttpaddressThe platform needs to notify you in advance.
Device Initiationhttpask
JSON{ "app": "2.2.5-jsd4", "mac": "8002F4300020", "type": 0, //Not used yet}Local area network adoptsUDPObtained via broadcastmqttaddress
    Basic settings:
Device listening port:53294
Device broadcast port:53293
The device initiates a broadcast request:
Plain Text{ "app": "2.2.5-jsd4", "mac": "8002F4300020", "type": 0, //Not used yet}Local area network adoptshttpGetmqttaddress 
   Example:http:// + local_server_ip + /mqtt_address/
       local_server_iplike192.168.0.13
   Notice:
The above address can be set via the network settings in the device menu.-Server address configuration
Local area network must be enabled; see device menu network settings.-Local area network (default is connected to the external network)
   The device initiates a request:
JSON{ "app": "2.2.5-jsd4", "mac": "8002F4300020", "type": 0 //0Door station (unit unit)  1Indoor unit 2Management machine  3Fence machine 4Villa machine 5Press the intercom button 6bread machine}Note:
typeYou can set device parameters(params.set)Command Configurationdevice_typeField changed.
typeThe yellow sections can be changed.

Platform response or LAN platform response
JSON{ "result": 0, //0success 1fail    "mqtt": { "host": "", "port": "", //port string        "client_id": "8002F4300020", "user_name": "",//Username cannot be empty.        "password": "",//Password cannot be empty        "sub": "", //Subscribe to topics iot/sub/0101/8002F4300015/ "pub": "" //Post a topic  iot/pub/0101/8002F4300015/ "enable_tls": false, //Enable or disable?MQTTS/TLS,You can leave this field blank if you don't want to enable it.        "ca_file_url": "https://xxx/jsd.crt",// caCertificate download address        "voip_http_addr": "intercomhttpaddress",//Intercom request address; you can leave this blank if you don't need intercom.        "enable_heartbeat": false, //If the field istrueThe equipment will every1A heartbeat packet is sent every minute.dev.heartbeatOrder    },}Equipment registration (dev.register)
Request parameters (corresponding basic format)params(field)
JSON{ "device_type": 0, //0Door station (unit unit)3Fence machine 4Villa machine 5Press the intercom button 6Intercom not supported(bread machine)    "device_ip": "", "hardware_type": "JSD-X50", //Upgrades differentiate between different upgrade packages    "software_version": "V6.0", "software_type": "", "chip_type": "ssd222d", //Upgrades differentiate between different upgrade packages    "enable_finger": false, //Enable fingerprint    "enable_lift": false, //Enable elevator control    "enable_voip": false, //Enable intercom}Note:
chip_typeinclude
ssd222
ssd222d
ssd2351
ssd2351d
hardware_typeinclude:
JSD-X28 2.8inch equipment
JSD-X43 4.3inch equipment
JSD-X50 5inch equipment
JSD-X55 5.5inch equipment
JSD-X60 6inch equipment
JSD-X70 7inch equipment
JSD-X80 8inch equipment
JSD-X101 10.1inch equipment
Request and response data (corresponding basic format)data(field)
JSON{ "device_status": 1, //Machine status1.Enable, 2.freeze(Freeze only non-administrator users)No need to set if you don't want to change it.    "device_name": "jsd",//Device name, you don't need to set it if you don't want to change it.    "display_qrcode": "test",//QR code,Scan to open WeChat mini program. No need to set if you don't want to change it.                       //To ensure compatibility with older devices,device_typeUse strings                       //The device type can be changed; otherwise, no settings are required.    "device_type": "0", //0Door station (unit unit)3Fence machine 4Villa machine 5Press the intercom button 6Intercom not supported(bread machine)}Device heartbeat (dev.heartbeat)
Request parameters (corresponding basic format)params(field)
Plain Text{ "timestamp": 44,//Current equipmentUNIXTimestamp    "ip": "", //Equipment whenIP address "sim_ccid": "125454665565",//4gcard number    "network_type": 0, //0wired 1 WiFi 2 4GRequest and response data (corresponding basic format)data(field)
No response required
Note: If heartbeat is enabled (refer to the platform response or LAN platform response protocol), the device will...1Send a heartbeat packet every minute.

Report network information (network_info.report)
Request parameters (corresponding basic format)params(field)
Plain Text{ "sim_ccid": "125454665565",//4gcard number    "ip": "", //Equipment whenIP address "network_type": 0, //0wired 1 WiFi 2 4GRequest and response data (corresponding basic format)data(field)
No response required
Note: When the device network type changes, the device network information should be reported once.


Add a super administrator and bind the device.admin.add)
Platform request parameters (corresponding basic format)params(field)
JSON{}Request and response parameters (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail}Note:
According to the basic format of the homepage Basic formatThe fieldsaccountandpasswordTo set up administrator information.
This command must be effective.Enter the device menu-Network settings-You can only add devices through the device binding interface.
Unbinding device (dev.unbind)
Device initiates request parameters (corresponding basic format)params(field)
JSON{}Request and response parameters (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail}Note:
Enter device menu-Network settings-When unbinding a device, the system will send a message to the platform.dev.unbindOrder
equipmentmqttWorkflow



Set device parameters(params.set)
Request parameters (corresponding basic format)params(field)
JSON{ "device_status": 1, //Machine status1.Enable, 2.freeze    "build_id": 1, //Building    "unit_id": 1, //unit    "room_id": 1, //Room, location code (for elevator control)    "open_delay": 4, //Door opening delay (S)    "open_lift_delay": 5, //Elevator door opening delay(S) "volume": 100, // //Device volume[0, 100] "recognize_score": 80, //Face threshold[0, 100] "ir_score": 80, //Face infrared threshold[0, 100] "wiegand_type": 0, //Wiegand Output Mode 0.No output  1.WG26 2.WG34 3.Custom    "enable_remote_open": 0, //Enable remote door opening function?: bit[0].main switch;bit[1].Head of household;bit[2].Regular users    "screen_off_time": 30, //Screen always on time    "enable_face": true, //Face enable: false.Disable  true.Enable    "enable_iccard": true, // ICCard enable: false.Disable  true.Enable    "enable_finger": false,//Fingerprint Enable: false.Disable  true.Enable    "enable_common_pwd": true, //Public cryptography function: false.Disable  true.Enable    "enable_family": true, //Is it permissible for the homeowner to add family members?: false.no  true.Yes; the user added by the administrator.=Homeowner, users added by homeowner=member(Members can no longer add users.)There are only three levels of relationships.    "enable_display_qrcode": true,//Should I display the QR code?: false.no  true.yes         "enable_user_pwd": true,//Personal password function: false.Disable  true.Enable    "enable_upload_qrcode": false,//Upload QR code,QR code remote verification    "enable_strange_pass": false,//Strangers pass    "enable_strange_snapshot": false,//Stranger snapshots    "enable_snapshot": true,//Traffic capture    "enable_upload_record": true, //Upload history    "enable_dual_card_open": false,//Dual card opening: false.Disable  true.Enable    "enable_tts": false,// TTS: false.Disable  true.Enable    "enable_qrcode_reader": false,//Enable QR code scanning head function?: false.no  true.yes    "enable_screen_off": true,//Allow the screen to stay on.: false.yes  true.no    "enable_display_pass_name": true, //Should the names of those passing through be displayed?    "device_type": 0,//0Door station (unit unit) 3Fence machine 4Villa machine 5Press the intercom button 6bread machine         "device_name": "jsd",//Equipment Name    "display_qrcode": "test",//QR code,Scan to open WeChat mini program    "common_pwd": "123456",//Public password, number, length[1,8] "menu_pwd": "123456",//Menu password, numbers, length6 "sim_ccid": "",// SIMcard number,equipment4GCard number, this parameter is not needed for distribution; it is read from the device.4Gcard number    "time_seg": "", //Opening hours    "free_time_seg": "",//Normal operating time period    "poll_wechat_openid_timeout": 30, //WeChatopenidPolling call timeout time, unitS "card_no_desc": true,}Note:
If no parameters are set, they can be omitted.
Normal operating hours (free_time_seg): Start date and timestamp (uint32_t)+End date timestamp (uint32_t)+Start time1[Hours and minutes (unit: minutes)](uint16_t) +End time1[Time](uint16_t)+Start time2[Time](uint16_t) +End time2[Time](uint16_t)+Start time3[Time](uint16_t) +End time3[Time](uint16_t)+week(uint8_t,Open Week(binary Eight,The high position is a normally open switch.;0=close, 1=open. The second place is Sunday.,The third is Zhou.1…..And so on,For example, open on Sundays and Sundays.3,The resulting binary value is01001000=0x48; weeks[1]=0x48))+floor(uint64_t,(Open floors),Total29byte
User time period (time_seg): Start date and timestamp (uint32_t)+End date timestamp (uint32_t)+Start time1[Hours and minutes (unit: minutes)](uint16_t) +End time1[Time](uint16_t)+Start time2[Time](uint16_t) +End time2[Time](uint16_t)+Start time3[Time](uint16_t) +End time3[Time](uint16_t)+week(uint8_t,Open Week(binary Eight,The high position is a normally open switch.;0=close, 1=open. The second place is Sunday.,The third is Zhou.1…..And so on,For example, open on Sundays and Sundays.3,The resulting binary value is01001000=0x48; weeks[1]=0x48)),common10Each time periodtwenty onebytes, total2101 byte.
Example of normally open time period
694eb1009498d200021c02d10329042700000000bf0000000000000000
Detailed analysis:
start date:2025-12-27
End Date:2049-01-01
Start time1:09:00
End time1:12:01
Start time2:13:29
End time2:17:43
Start time3:0Not set
End time3:0Not set
Week: Valid from Monday to Saturday; no access is granted on Sunday; always on.
floor:0, Not set
User time period example
694eb1009498d200021c02d10329042704740564bf00000000000000000000000000000000000000000000000000000000 000000000000000000000000000000000000000000000000000000000000000000000000000 000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
Detailed analysis:
Time group1:
start date:2025-12-27
End Date:2049-01-01
Start time1: 09:00
End time1:12:01
Start time2:13:29
End time2:17:43
Start time3:19:00
End time3:twenty three:00
Week: Valid from Monday to Saturday; no access is granted on Sunday. Enable this time period.
Other time groups: Not set, all are...0
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail}Obtain device parameters(params.get)
Request parameters (corresponding basic format)params(field)
JSON{}Request and response data (corresponding basic format)data(field)
JSON{ "device_status": 1, //Machine status1.Enable, 2.freeze    "build_id": 1, //Building    "floor_id": 1, //floor    "room_id": 1, //Room    "open_delay": 4, //Door opening delay (S)    "open_lift_delay": 5, //Elevator start delay control (S)    "volume": 100, //Device volume[0, 100] "recognize_score": 80, //Face threshold[0, 100] "ir_score": 80, //Face infrared threshold[0, 100] "wiegand_type": 0, //Wiegand Output Mode 0.No output  1.WG26 2.WG34 3.Custom    "enable_remote_open": 0, //Enable remote door opening function?: bit[0].main switch;bit[1].Head of household;bit[2].Regular users    "screen_off_time": 30, //Screen always on time        "enable_face": true, //Face enable: false.Disable  true.Enable    "enable_iccard": true, // ICCard enable: false.Disable  true.Enable    "enable_finger": false,//Fingerprint Enable: false.Disable  true.Enable    "enable_common_pwd": true, //Public cryptography function: false.Disable  true.Enable    "enable_family": true, //Is it permissible for the homeowner to add family members?: false.no  true.Yes; the user added by the administrator.=Homeowner, users added by homeowner=member(Members can no longer add users.)There are only three levels of relationships.    "enable_display_qrcode": true,//Enable QR code scanning?(Scan the QR code printed on the device with your phone's camera)Function: false.no  true.yes             "enable_user_pwd": true,//Personal password function: false.Disable  true.Enable    "enable_upload_qrcode": false,//Upload QR code,QR code remote verification    "enable_strange_pass": false,//Strangers pass    "enable_strange_snapshot": false,//Stranger snapshots    "enable_snapshot": true,//Traffic capture    "enable_upload_record": true, //Upload history    "enable_dual_card_open": false,//Dual card opening: false.Disable  true.Enable    "enable_tts": false,// TTS: false.Disable  true.Enable    "enable_qrcode_reader": false,//Enable QR code scanning head function?: false.no  true.yes    "enable_screen_off": true,//Allow the screen to stay on.: false.yes  true.no       "device_type": 0,//0Door station (unit unit) 3Fence machine 4Villa machine 5Press the intercom button 6Intercom not supported(bread machine)               "device_name": "jsd",//Equipment Name    "display_qrcode": "test",//QR code,Scan to open WeChat mini program    "common_pwd": "123456",//Public password, number, length[1,8] "menu_pwd": "123456",//Menu password, numbers, length[1,8] "sim_ccid": "",// SIMcard number,equipment4GCard number, read from the device4Gcard number    "time_seg": "", //Opening hours    "free_time_seg": "",//Normal operating time period    "poll_wechat_openid_timeout": 30, "card_no_desc": true}
Equipment Reset(dev.reset)
Request parameters (corresponding basic format)params(field)
JSON{}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail}
Device restart(dev.reboot)
Request parameters (corresponding basic format)params(field)
JSON{}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail}
Equipment upgrade(dev.upgrade)
Request parameters (corresponding basic format)params(field)
JSON{ "url": "https://" //Upgrade package download addresshttporhttps getRequest method}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail}

Remote door opening(door.open)
Request parameters (corresponding basic format)params(field)
JSON{ "type": 1 //1Remote door opening6Temporary password to open door 7Public password to open door 11Close-range door opening (for attendance tracking) 15Visitor call elevator  16Residents call elevator    "password": "", //Only type6and7This field is only valid at that time.    "floor": "0000000000000000", //Only type15and16This field is valid at that time, and the total number of floors is [number missing].64Position, position is1This indicates that you have permission to use that floor.    "cloud_user_id": "WeChat usersID",}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success  1.fail     "cloud_user_id" : "WeChat usersID",}
Add personnel(person.add)
Request parameters (corresponding basic format)params(field)
Fields that have not been modified can be left blank to retain the original data values ​​on the device.
JSON{ "persons":[ { "account": "ffdad",//User accounts must be unique; if an account exists, it must be changed. The platform can use this field to synchronize personnel information between devices. This field can be empty.            "name": "",//Username (required)            "type": "240",//Personnel type,0xF0,An empty value indicates that the item is not set.            "time_seg": "1", //Time period; blank indicates this item is not set. Refer to device parameters.time_segFields, at most10Time period[1~10]            "card_no": "ab123456",//Card number; an empty field indicates that this item is not set.,Otherwise it must be8Bit16Numeric characters            "auth_mask": "",//Permission flag; an empty value indicates that the item is not set.            "face_img_base64": "",//Face image; empty indicates that this item is not set.            "password": "123456",//Personal password[1,8]A digit, empty to indicate clear password.            "expire_date": "" //Expiry dateUNIXTimestamp, empty indicates that this item is not set.            "floor": "0000000000000000", //Total floors64Position, position is1A value of '-' indicates that the user has permission for that floor; an empty value indicates that the option is not set.        }, ]}Note:
User type (type):bit[7]:This position is1This indicates that the administrator is the one in question.(Maximum total3One manager,The others are0); bit[6].This position is1, indicating the owner; bit[5].This position is1, indicating a regular user bit[4].This position is1This indicates a temporary visitor user; the system will automatically delete them after their membership expires.;bit[0]:0.Permissions not approved(The door cannot be opened.);1.Permissions have been approved and activated.;
User permissions (auth_mask):bit[7].1Allow faces;bit[6].1Allow fingerprints;bit[5].1Allow Card;bit[4].1Allow password bit[3]1.No facial recognition restrictions,0.Only one face is allowed;bit[2].1Infinite fingerprint;bit[1].1Unlimited Cards;bit[0].1Infinite Passworddefault 255
User time period (time_seg):User Time Group(Validity period+Valid time period); 0=No time group
User's valid deadline (expire_date):default0:No time limit
You can leave the above fields blank or provide an empty string if they are not available.
aboutaccount,A unique identifier for each person, which can be used for personnel synchronization across different devices. For locally created personnel, this field is...__Initially, the platform can pull local users and then convert them into platform users by changing their accounts to unique accounts generated by the platform.
Request and response data (corresponding basic format)data(field)
JSON{ [ { "id": 1,//userIDThe current device's unique identifier            "account": "ffdad", //A unique identifier between different devices; if this identifier is generated on the device side, it will have a prefix indicating that the device is not generated.__This character can be changed by the platform to become a unique identifier for the platform.            "result": 0, //0success 1fail, When the result fails1hour,idInvalid, for0 "feature": "" //If a face is sent, the facial features are returned.            "face_img": "" //If a face is sent, the system returns a photo of the face corresponding to the given features.base64data        }, ], }Delete personnel(person.del)
Request parameters (corresponding basic format)params(field)
JSON{ "account": "ffdad", //If an account exists, priority will be given to deleting the account.   ids: [1,2] //Delete personnelid}Request and response data (corresponding basic format)data(field)
JSON{ [ { "id": 1 //Delete personnelid "account": "ffdad", "result": 0 // 0.success, 1.fail        }, ]}Personnel Information,Clear all personnel from the equipment.person.clear)
Request parameters (corresponding basic format)params(field)
JSON{ }Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Acquisition personnel(person.get)
Request parameters (corresponding basic format)params(field)
JSON{ "page": 1,//Page Index    "page_size": 10,//Page size    "with_image": true, //Return image?    "user_id": 1, "name": "sxj" //Does this search involve fuzzy searching by name? If the field is not found, return the list of users visible to the current user.}Note:
IfnameThe parameter is used to perform a fuzzy search based on the user's name./search;user_id=0For unspecified users (operator account must be included)account,refer to1.Basic format Basic format),This is0It will then read the list of all users that it has permission to read.(Administrators can read the entire table.,Non-administrators can only read themselves and their subordinates.);user_idfor-1hour,according toaccountfilter,Return only1Information of the current user;whenuser_idGreater than0hour,according touser_idThe filter reads only one user's information.
Request and response data (corresponding basic format)data(field)
JSON{ total: 10, //Current total number of personnel   persons: [ { "id": 1, //userid "parent_id": 0, //fatherid,Administrator Fatheridfor0 "type": 240,//Personnel type            "name": "",//username            "time_seg": 1, //Time period            "account": "dfdfd", "card_no": "",//card number            "auth_mask": "",//Permission flags            "face_img_base64": "",//Face images            "expire_date": 0 //Expiry dateUNIXTimestamp            "card_cnt": 1, //One person can add multiple cards.            "pwd_cnt": 0, "face_cnt": 1, //One person can add multiple faces.            "finger_cnt": 0 //One person can add multiple fingerprints.        }, ]}Add face(face.add)
Request parameters (corresponding basic format)params(field)
JSON{ "faces": [ { "user_id": 1, //personnelid "account": "", //Personnel accounts, with priority given to adding accounts.            "type": "jpg", //dataField type, jpg;feature "data": "", //type="jpg",Face imagesbase64;type="feature",datafacial features            "face_img": "Face imagesbase64" //whentypeforfeatureThis field is valid, indicating the image corresponding to the feature.        }, ]}Note:
foruser_idoraccountUser adds face,A user can add multiple faces. If a face has already been registered, the user information associated with that face will be deleted.
This command will only succeed if users have already been added.
Facial photos must be taken in accordance with96 x 160Send proportionally, the total packet size cannot exceed250k


Request and response data (corresponding basic format)data(field)
JSON{ [ { "result": 0, "face_id": 2, "user_id": 1 }, ]}
On-site facial recognition(face.live)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, //People whose faces are currently waiting to be enteredID "account": "xxx" //If it exists, add it using the account first.}Note:
foruser_idoraccountPersonnel add faces at the equipment site
Facial photos must be taken in accordance with96 x 160Send proportionally, the total packet size cannot exceed250k

Request and response data (corresponding basic format)data(field)
JSON{ "user_id": 1, "face_id": 2, //Return to the face of the person who was successfully added.id     "result": 0, // 0.success, 1.fail     "account": ""}
Get face(face.get)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1,// user_id=0,Read all user facesuser_id0,Only read faces under the current user    "page": 1, "page_size": 5,}Note:
user_id=0For unspecified users(Operator account must be brought.account,refer to1.Basic format Basic format),This is0It will read the faces of all users who have permission to read them.(The administrator can read the entire table.,Non-administrators can only read themselves andf_user_idIt is one's own subordinate.);user_id0hour,Read only one user's facial data;
Request and response data (corresponding basic format)data(field)
JSON{ [ { "user_id": 1, "face_id": 2, "feature": "" //Facial features            "face_img": "base64picture//Facial photos corresponding to the features        },    ]}
Delete face(face.del)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, "account": "", //Personnel accounts, with priority access for account deletion.    "face_ids": [4, 5, 6]}Note:
user_id=0Furthermore, since the user accounts are empty, all facial recognition data will be deleted.face_idsIf not empty, delete the specified value.face_idsFaceface_idsEmpty deleteuser_idAll faces under a username; if the user account is not empty, delete all faces under that user account.
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}
Add card(card.add)
Request parameters (corresponding basic format)params(field)
JSON{ "cards": [ { "user_id": 1, "account": "", //Personnel accounts, with priority given to adding accounts.            "card_no": "12345678", //The card number must be8Bit16number system characters        }, ]}Request and response data (corresponding basic format)data(field)
JSON{ [ { "result": 0, // 0.success, 1.fail              "user_id": 1, }, ]}
On-site data entry card(card.live)
Request parameters (corresponding basic format)params(field)
JSON{ "account": "", //Personnel accounts, with priority given to adding accounts.    "user_id": 1 //Current personnel to be enteredID}Request and response data (corresponding basic format)data(field)
JSON{ "user_id": 1,     "card_no": "card number",     "result": 0, // 0.success, 1.fail     "account": "xxx"}
Get Card(card.get)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1,// user_id=0,Read all user card numbersuser_id0,Read only one user card number; user_id<0,Read all card numbers under the current user    "page": 1, "page_size": 5,}Request and response data (corresponding basic format)data(field)
JSON{ [ { "user_id": 1, "card_no": "12345678" //card number        },    ]}

Deletion Card(card.del)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, "account": "xxxx", //Personnel accounts, with priority access for account deletion.    "card_nos": ["22222222", "34445577", "55555555"]}Note:
user_id=0And since the account is empty, all card numbers will be deleted.card_nosNot empty, deletecard_nosSpecified card numbercard_nosEmpty deleteuser_idAll card numbers under the username; if the account is not empty, delete all card numbers under the account.
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}
Add fingerprint(finger.add)
Request parameters (corresponding basic format)params(field)
JSON{ "fingers": [ { "user_id": 1, //personnelid "account": "xxxx", //Personnel accounts, with priority given to adding accounts.            "feature": "", //fingerprint featuresbase64coding        }, ]}Note: Add fingerprint touser_idUsername

Request and response data (corresponding basic format)data(field)
JSON{ [ { "result": 0, "finger_id": 2,//fingerprintid "user_id": 1, }, ]}
On-site fingerprinting(finger.live)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, //People currently waiting to have their fingerprints recordedID "account": "xxxx", //Personnel accounts, with priority given to adding accounts.}Note: On-site fingerprint registration added to...user_idUnder his name.

Request and response data (corresponding basic format)data(field)
JSON{ "user_id": 1, "finger_id": 2, //Returning to the successfully added fingerprintsid     "result": 0, // 0.success, 1.fail     "account": "xxxx", }
Obtain fingerprint(finger.get)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1,// user_id=0,Read all user facesuser_id0,Only read faces under the current user    "page": 1, "page_size": 5,}Request and response data (corresponding basic format)data(field)
JSON{ [ { "user_id": 1, "finger_id": 2, "feature": "" //fingerprint featuresbase64,    ]}
Deleting fingerprints(finger.del)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, "account": "xxxxx", //Personnel accounts, with priority access for account deletion.    "finger_ids": [4, 5, 6]}Note:
user_id=0Furthermore, if the account is not empty, all fingerprints will be deleted.finger_idsIf not empty, delete the specified value.finger_idsfingerprintfinger_idsEmpty deleteuser_idAll fingerprints under the username; if the account is not empty, delete all fingerprints under the account.
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}
Increase visitors(visitor.add)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, //Only one user per deviceid "type": 1, //type0.Limited Time Offer1.Limited times2.Limited time and limited number of times    "start_date": 1, //Valid start time (replace with timestamp)    "end_date": 2,//Valid end time (replace with timestamp)"times": 1, //Valid number of times    "password": "123456",//Visitor password[1,8]Number of digits    "account": "", //Platform OnlyIDIf this field is not empty, the platform's unique identifier will be used first.ID(user_id(Optional)}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}
Acquiring visitors(visitor.get)
Request parameters (corresponding basic format)params(field)
JSON{ "user_id": 1, "page": 1, "page_size": 5,}Note:
user_id=0For unspecified users(Operator account must be brought.account,refer to1.Basic format Basic format),This is0It will then read the list of records for all users with access permissions.(The administrator can read the entire table.,Non-administrators can only read themselves andf_user_idIt is one's own subordinate.);user_id0hour,Read visitor data for only one user;
Request and response data (corresponding basic format)data(field)
JSON{ [ { "user_id": 1, "type": 1, //type0.Limited Time Offer1.Limited times2.Limited time and limited number of times            "start_date": 1, //Valid start time (replace with timestamp)            "end_date": 2,//Valid end time (replace with timestamp)"times": 1, //Valid number of times            "password": "123456",//Visitor password[1,8]Bit            "account": "" }, ]}
Retrieve Records(record.get)
Request parameters (corresponding basic format)params(field)
JSON{ "page": 1, "page_size": 1, // "start_date": 1, //Valid start time (replace with timestamp)    "end_date": 2,//Valid end time (replace with timestamp)"with_image": true,}Request and response data (corresponding basic format)data(field)
JSON{ [ { "id": 1, //RecordID "user_id": 1, "pass_type": 1, //Passage type            "pass_status": 1, //Passage status            "score": 0.6,//  Face score            "card_no": "", "name": "",//Name of Passengers            "snapshot_base64": "", "face_image_base64": "", "created_at": 55 //unixTimestamp         }, ]}
Delete records(record.del)
Request parameters (corresponding basic format)params(field)
JSON{ "user_ids": [ "user_id": 1,//List of users to delete records from    ]}Note:
user_ids,List of users to delete records fromuser_idsWhen empty,This will delete all records of all users under your own level and all records of yourself.

Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Clear record information (record.clear)
Request parameters (corresponding basic format)params(field)
JSON{ }Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Record reporting(post.record)
Request parameters (corresponding basic format)params(Fields) [Consider whether record reporting should go through...]HTTP[Method, configure receiving address, and also perform pass confirmation]
JSON{ "id": 1, //RecordID "user_id": 1, //personnelid "account": "fdfd", //Personnel Accounts        "pass_type": 1, //Passage type        "pass_status": 1, //Passage status        "score": 0.6,//  Face score        "card_no": "", "name": "",//Name of Passengers        "snapshot_base64": "", "face_image_base64": "", "created_at": 11, "is_check":0 // 0This indicates local clearance.1This indicates that server confirmation is required to allow the request.}Note:
pass_type:
        0:Swipe card to open door
        1Remote door opening via mobile phone,
        2Temporary password for mobile phone to open door
        3: Universal mobile phone password for door opening
        4: Facial recognition for door opening
        5: Temporary keypad for door opening,
        6: Universal keypad door opening,
        7Temporary key to open door,
        8Remote door opening from the back end,
        9Fingerprint door opening,
        10Palm prints reveal the secrets of life,
        11.Open the door at close range (similar to DingTalk)
        12.Bluetooth door opening
    13Fire alarm signal
    14:  Anti-theft signal
    15:  Gate magnetic signal
    16:  Capture Record
  17.Keyboard password unlock (personal password)
        18.Remote unlocking/Visitor call (extension monitoring)/Answer the call to unlock (or use the mini-program to answer the call to unlock).
        19.Residents call elevator
  20.Call for snapshot 
   twenty one.Open the door by swiping your ID card
     pass_status:
0: allow
1: deny
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail     "id": 1 //RecordID}Change hardware parameter configuration (hardware_cfg.set)
Request parameters (corresponding basic format)params(field)
JSON{ "reader_type": "0" // 0standardicCard 1Anti-copy card 3Online ID Card 4Offline ID card     "hardware_cfg": "85", // bit7Is it a walkie-talkie?                            // bit3  Is it elevator controlled?                            //bit2  Do I need to swipe my card?                            // bit1  fingerprint                            // bit0  Does it require facial recognition?                            //05Supports card payment and facial recognition.                             // 07Supports card swiping, fingerprint scanning, and facial recognition.                           // 0DSupports card swiping, facial recognition, and elevator control.                           // 0FSupports card swiping, fingerprint scanning, facial recognition, and elevator control.                           // 85Supports card swiping, facial recognition, and intercom.                                "start_pic": "http://download_address",//Boot-up photo address (photo format)jpg,(Screen resolution and corresponding screen size)     "type_4g": "0", // 0He Zhou 1mid-shift 2Domainx09 "time_zone": "CST-8", // CST-8Beijing time     "language": "Chinese" // Chinese-Simplified Chinese EnglishEnglish Portuguese-Portuguese}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Set system time (time.set)
Request parameters (corresponding basic format)params(field)
JSON{ "timestamp": 44,//currentUNIXTimestamp}
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Get system time (time.get)
Request parameters (corresponding basic format)params(field)
JSON{ }
Request and response data (corresponding basic format)data(field)
JSON{ "timestamp": 44,//currentUNIXTimestamp}Native WeChat intercomWeChat mini program actively calls the device (voip.call)
Request parameters (corresponding basic format)params(field)
JSON{ "name": "",//The caller's name is displayed on the device's call interface.      "room_id": "", //Roomid,Mini Program provides      "timestamp": 44,//currentUNIXThe device will compare the timestamps; if the difference exceeds [a certain threshold], [the device will take action].30SIf it is, it means the command has expired and will not be processed.}
Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Hang up the intercom(voip.hangup)
Request parameters (corresponding basic format)params(field)
JSON{ }Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail}Get the next oneopenid(voip.get_next_openid)
Request parameters (corresponding basic format)params(field)
JSON{ }Request and response data (corresponding basic format)data(field)
JSON{ "result": 0, // 0.success, 1.fail     "name": "name",//Name of the person being called     "callid": "", //callid "type": "0"}Report call status(voip.report_status)
Request parameters (corresponding basic format)params(Fields) [Consider whether record reporting should go through...]HTTP[Method, configure receiving address, and also perform pass confirmation]
JSON{ "voip_status": 1, //During the call}Request and response data (corresponding basic format)data(field)
JSON{ "result": 0 // 0.success, 1.fail     }
Voice call (audio.call)
Request parameters (corresponding basic format)params(field)
JSON{ "type": 0, //pcmFormat    "audio": "base64audio"}Request and response data (corresponding basic format)data(field)
Plain Text{ "result": 0, // 0.success, 1.fail     "room_no": "", "type": 0,//Voice type,0 pcm "audio": "Prompt voice,base64Format", "tips": "Prompt text"}Mini Program Administrator Temporary Password Generation Rules

According to the above rules, temporary passwords can be used offline.







