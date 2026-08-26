// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LiteStream {
    struct Stream {
        address sender;
        address recipient;
        uint256 deposit;
        uint256 withdrawn;
        uint64 startTime;
        uint64 endTime;
        uint64 canceledAt;
        bool cancelable;
        bool canceled;
    }

    uint256 public streamCount;
    mapping(uint256 => Stream) public streams;
    uint256 private _locked = 1;

    event StreamCreated(uint256 indexed streamId,address indexed sender,address indexed recipient,uint256 deposit,uint64 startTime,uint64 endTime,bool cancelable);
    event Withdrawn(uint256 indexed streamId,address indexed recipient,uint256 amount);
    event StreamCanceled(uint256 indexed streamId,address indexed sender,uint256 recipientPaid,uint256 senderRefund);

    modifier nonReentrant() {
        require(_locked == 1, "Reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    function createStream(address recipient,uint64 startTime,uint64 endTime,bool cancelable)
        external payable returns (uint256 streamId)
    {
        require(recipient != address(0), "Invalid recipient");
        require(recipient != msg.sender, "Recipient is sender");
        require(msg.value > 0, "Deposit required");
        require(endTime > startTime, "Invalid duration");
        require(endTime > block.timestamp, "Stream already ended");
        require(startTime >= block.timestamp, "Start must be now/future");

        streamId = ++streamCount;
        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            deposit: msg.value,
            withdrawn: 0,
            startTime: startTime,
            endTime: endTime,
            canceledAt: 0,
            cancelable: cancelable,
            canceled: false
        });

        emit StreamCreated(streamId,msg.sender,recipient,msg.value,startTime,endTime,cancelable);
    }

    function vestedAmount(uint256 streamId) public view returns (uint256) {
        Stream memory stream = streams[streamId];
        require(stream.sender != address(0), "Stream not found");

        uint256 effectiveTime = block.timestamp;
        if (stream.canceled && stream.canceledAt < effectiveTime) effectiveTime = stream.canceledAt;
        if (effectiveTime <= stream.startTime) return 0;
        if (effectiveTime >= stream.endTime) return stream.deposit;

        uint256 elapsed = effectiveTime - stream.startTime;
        uint256 duration = stream.endTime - stream.startTime;
        return (stream.deposit * elapsed) / duration;
    }

    function withdrawableAmount(uint256 streamId) public view returns (uint256) {
        Stream memory stream = streams[streamId];
        require(stream.sender != address(0), "Stream not found");
        uint256 vested = vestedAmount(streamId);
        return vested > stream.withdrawn ? vested - stream.withdrawn : 0;
    }

    function withdraw(uint256 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        require(stream.sender != address(0), "Stream not found");
        require(msg.sender == stream.recipient, "Only recipient");

        uint256 amount = withdrawableAmount(streamId);
        require(amount > 0, "Nothing withdrawable");

        stream.withdrawn += amount;
        (bool ok,) = payable(stream.recipient).call{value: amount}("");
        require(ok, "Transfer failed");

        emit Withdrawn(streamId, stream.recipient, amount);
    }

    function cancelStream(uint256 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        require(stream.sender != address(0), "Stream not found");
        require(msg.sender == stream.sender, "Only sender");
        require(stream.cancelable, "Not cancelable");
        require(!stream.canceled, "Already canceled");

        uint64 cancelTime = uint64(block.timestamp);
        if (cancelTime > stream.endTime) cancelTime = stream.endTime;

        stream.canceled = true;
        stream.canceledAt = cancelTime;

        uint256 vested = vestedAmount(streamId);
        uint256 recipientDue = vested > stream.withdrawn ? vested - stream.withdrawn : 0;
        uint256 senderRefund = stream.deposit - vested;

        stream.withdrawn = vested;

        if (recipientDue > 0) {
            (bool recipientOk,) = payable(stream.recipient).call{value: recipientDue}("");
            require(recipientOk, "Recipient transfer failed");
        }
        if (senderRefund > 0) {
            (bool senderOk,) = payable(stream.sender).call{value: senderRefund}("");
            require(senderOk, "Refund failed");
        }

        emit StreamCanceled(streamId, stream.sender, recipientDue, senderRefund);
    }

    function getStream(uint256 streamId)
        external view
        returns (
            address sender,address recipient,uint256 deposit,uint256 withdrawn,
            uint64 startTime,uint64 endTime,bool cancelable,bool canceled,uint64 canceledAt,
            uint256 vested,uint256 withdrawable
        )
    {
        Stream memory stream = streams[streamId];
        require(stream.sender != address(0), "Stream not found");

        return (
            stream.sender, stream.recipient, stream.deposit, stream.withdrawn,
            stream.startTime, stream.endTime, stream.cancelable, stream.canceled,
            stream.canceledAt, vestedAmount(streamId), withdrawableAmount(streamId)
        );
    }

    receive() external payable {
        revert("Use createStream");
    }
}
