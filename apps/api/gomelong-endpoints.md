Select a definition

STSPrepaymentVendApi v1
STS Vend System API
 v1 
OAS 3.0
http://120.26.4.119:9094/swagger/v1/swagger.json
The API for STS vend system

Kmf
KMF management



GET
/api/Kmf/ListSgcByMeterType
List SGC by meter type

Parameters
Try it out
Name	Description
meterType *
integer($int32)
(query)
meter type(1-electric|2-water)

meterType
Responses
Code	Description	Links
200	
OK

No links
Power
Recharge meter management



GET
/api/Power/GetChangeDecoderToken
Get the token of change decoder key

Parameters
Try it out
Name	Description
MeterCode *
string
(query)
The meter code

MeterCode
MeterType *
integer($int32)
(query)
The meter type (1-Electric | 2-Water)

MeterType
SgcId *
string
(query)
The new SGC ID

SgcId
UserId *
string
(query)
The user id

UserId
Password *
string
(query)
The password

Password
Responses
Code	Description	Links
200	
OK

No links

GET
/api/Power/GetClearCreditToken
Get the token of clear credit

Parameters
Try it out
Name	Description
UserId *
string
(query)
The user id

UserId
Password *
string
(query)
The password

Password
MeterCode *
string
(query)
The meter code

MeterCode
MeterType *
integer($int32)
(query)
The meter type (1-Electric | 2-Water)

MeterType
Responses
Code	Description	Links
200	
OK

No links

GET
/api/Power/GetClearTamperSignToken
Get the token of clear tamper sign

Parameters
Try it out
Name	Description
UserId *
string
(query)
The user id

UserId
Password *
string
(query)
The password

Password
MeterCode *
string
(query)
The meter code

MeterCode
MeterType *
integer($int32)
(query)
The meter type (1-Electric | 2-Water)

MeterType
Responses
Code	Description	Links
200	
OK

No links

GET
/api/Power/GetContractInfo
Get the contract information of the meter

Parameters
Try it out
Name	Description
UserId *
string
(query)
The user id

UserId
Password *
string
(query)
The password

Password
MeterType *
integer($int32)
(query)
The meter type 1-electric 2-water

MeterType
MeterCode *
string
(query)
The meter code

MeterCode
Responses
Code	Description	Links
200	
OK

No links

GET
/api/Power/GetMaxPowerToken
Get the token of set max power

Parameters
Try it out
Name	Description
UserId *
string
(query)
The user id

UserId
Password *
string
(query)
The password

Password
MeterCode *
string
(query)
The meter code

MeterCode
Power *
integer($int32)
(query)
The max power(Unit:W)

Power
Responses
Code	Description	Links
200	
OK

No links

GET
/api/Power/GetVendingToken
Get the token of recharge

Parameters
Try it out
Name	Description
UserId *
string
(query)
The user id

UserId
Password *
string
(query)
The password

Password
MeterType *
integer($int32)
(query)
The meter type 1-electric 2-water

MeterType
MeterCode *
string
(query)
The meter code

MeterCode
AmountOrQuantity *
number($double)
(query)
The recharge amount or quantity is determined by the VendingType

AmountOrQuantity
VendingType *
integer($int32)
(query)
The type of vending 0-amount | 1-quantity

VendingType
Responses
Code	Description	Links
200	
OK

No links

POST
/api/Power/MeterDelete
Delete the meter

Parameters
Try it out
No parameters

Request body

multipart/form-data
UserId *
string
The user id

Password *
string
The password

MeterCode *
string
The meter code

MeterType *
integer($int32)
The meter type (1-Electric | 2-Water)

Responses
Code	Description	Links
200	
OK

No links

POST
/api/Power/MeterRegister
Register the meter

Parameters
Try it out
No parameters

Request body

multipart/form-data
UserId *
string
The user id

Password *
string
The password

UseTypeId *
string
The use type id

MeterCode *
string
The meter codes(Supports registering up to 20 meter codes simultaneously. If there are multiple, separate them with commas in English)

MeterType *
integer($int32)
The meter type 1-electric 2-water

CustomerName *
string
The customer name

Address
string
The address

PhoneNumber
string
The phone number

Fax
string
The fax

SgcId
string
sgc id

BillingMode
integer($int32)
The billing mode(0-Quantity | 1-Amount)

Responses
Code	Description	Links
200	
OK

No links

POST
/api/Power/MeterUpdate
Update the meter

Parameters
Try it out
No parameters

Request body

multipart/form-data
UserId *
string
The user id

Password *
string
The password

MeterCode *
string
The meter code

MeterType *
integer($int32)
The meter type 1-electric 2-water

CustomerName *
string
The customer name

Address
string
The address

PhoneNumber
string
The phone number

UseTypeId
string
The use type id

SgcId
string
The sgc id

BillingMode
integer($int32)
The billing mode(0-Quantity | 1-Amount)

Responses
Code	Description	Links
200	
OK

No links
UseType
Use type management



POST
/api/UseType/AddUseType
Add the use type

Parameters
Try it out
No parameters

Request body

multipart/form-data
UserId *
string
The user id

Password *
string
The password

UseTypeId *
string
The id of use type

UseTypeName *
string
The name of use type

MeterType *
integer($int32)
The meter type 1-electric 2-water

Price *
number($double)
The unit-price

Vat *
number($double)
The tariff

Responses
Code	Description	Links
200	
OK

No links

POST
/api/UseType/DeleteUseType
Delete the use type

Parameters
Try it out
No parameters

Request body

multipart/form-data
UserId *
string
The user id

Password *
string
The password

UseTypeId *
string
The id of use type

Responses
Code	Description	Links
200	
OK

No links

POST
/api/UseType/UpdateUseType
Update the use type

Parameters
Try it out
No parameters

Request body

multipart/form-data
UserId *
string
The user id

Password *
string
The password

UseTypeId *
string
The id of use type

Price *
number($double)
The unit-price

Vat *
number($double)
The tariff

Responses
Code	Description	Links
200	
OK

No links

GET
/api/UseType/UseTypeList
Get the use type list

Parameters
Try it out
Name	Description
userId *
string
(query)
The user id

userId
password *
string
(query)
The password

password
Responses
Code	Description	Links
200	
OK

No links
WaterVend
The water vend controller



POST
/api/WaterVend/PageVend
Page by page query of water vend records

Parameters
Try it out
Name	Description
PageNumber
integer($int32)
(query)
The page number (start by 1)

PageNumber
PageSize
integer($int32)
(query)
The page size (number of records per page)

PageSize
Request body

application/json
The water vend query dto

Example Value
Schema
{
  "userId": "string",
  "password": "string",
  "meterCode": "string",
  "startDate": "2026-03-15",
  "endDate": "2026-03-15"
}
Responses
Code	Description	Links
200	
OK

Media type

text/plain
Controls Accept header.
Example Value
Schema
{
  "code": 0,
  "message": "string",
  "data": "string"
}
No links

Schemas
RichResult{
code	[...]
message	[...]
data	{...}
nullable: true
}
WaterVendDTO{
description:	
The dto for water vend query

userId*	[...]
password*	[...]
meterCode*	[...]
startDate*	[...]
endDate*	[...]
}