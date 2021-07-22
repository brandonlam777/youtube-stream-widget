const { ipcRenderer, shell }        = require('electron')
const moment                        = require('moment')
const $                             = require( "jquery" );

//console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

class _widget{
    channels: any
    upcoming_streams: any

    streams: _streamItem[] = []

    ui:any = {
        grid: $('.grid')
    } 
    constructor(){
        this.attachEventListeners()
        setInterval(() =>{
            this.countdown()
        }, 1000 * 60)
    }

    attachEventListeners(){
        ipcRenderer.on('asynchronous-reply', (event, arg) => {
            console.log(arg) // prints "pong"
        })
        //ipcRenderer.send('asynchronous-message', 'ping')
        ipcRenderer.on('message', (event, message) => {
            console.log(message.data)
            switch(message.type){
                case 'channel_data':
                    this.channels = message.data
                    break
                case 'upcoming_streams':
                    if(JSON.stringify(this.upcoming_streams) == JSON.stringify(message.data))
                        return
                    this.ui.grid.empty();
                    this.upcoming_streams = message.data
                    this.process_upcoming_streams(this.upcoming_streams)
                    break
            }
        })

        this.ui.grid.on('click', '.stream_item', function(){
            shell.openExternal($(this).data('url'))
        })
    }

    process_upcoming_streams(streams: any){
        this.streams = []
        for(const stream of streams){
            stream.channel = this.channels[stream.snippet.channelId]
            let stream_item = new _streamItem(stream)
            this.streams.push(stream_item)
            stream_item.build_stream().appendTo(this.ui.grid)
        }
    }

    upcoming_time_string(stream: any){
        const scheduledStartTime = stream.liveStreamingDetails.scheduledStartTime
        const timeToStartHours = moment(scheduledStartTime).diff(moment().utc(), "hours")
        const timeToStartMinutes = moment(scheduledStartTime).diff(moment().utc(), "minutes") % 60
        
        let string = `In `
        if(timeToStartHours)
            string += `${timeToStartHours} hours `
        if(timeToStartMinutes)
            string += `${timeToStartMinutes} minutes `
        const stillUtc = moment.utc(scheduledStartTime).toDate();
        const local = moment(stillUtc).local().format('MM/DD h:mm a');
        const time_container = $(`<div class="time_container">`)
        $(`<div>`).text(string).appendTo(time_container)
        $(`<div>`).text(`${local}`).appendTo(time_container)
        return time_container
    }

    countdown(){
        for(let stream of this.streams){
            stream.update_time()
        }
    }
}

class _streamItem{
    stream: any
    stream_item_ui: any

    constructor(stream: any){
        this.stream = stream
    }
    

    build_stream(){
        const channel = this.stream.channel
        const stream_item = $(`<div class="stream_item" data-url="https://youtube.com/watch?v=${this.stream.id}">`)
        const channel_thumb_container = $(`<div class="channel_thumb_container">`).appendTo(stream_item)
        $(`<div class="channel_thumb">`).css('background-image', `url(${channel.snippet.thumbnails.high.url})`).appendTo(channel_thumb_container)

        const stream_info_container = $(`<div class="stream_info_container">`).appendTo(stream_item)
        $(`<div class="stream_title">`).text(this.stream.snippet.title).appendTo(stream_info_container)
        this.upcoming_time().appendTo(stream_info_container)
        const stream_thumb_container = $(`<div class="stream_thumb_container">`).appendTo(stream_item)
        $(`<div class="stream_thumb">`).css('background-image', `url(${this.stream.snippet.thumbnails.high.url})`).appendTo(stream_thumb_container)
        this.stream_item_ui = stream_item
        return stream_item
    }

    upcoming_time(){
        const scheduledStartTime = this.stream.liveStreamingDetails.scheduledStartTime
        const stillUtc = moment.utc(scheduledStartTime).toDate();
        const local = moment(stillUtc).local().format('MM/DD h:mm a');
        const time_container = $(`<div class="time_container">`)
        $(`<div class="countdown">`).text(this.time_string).appendTo(time_container)
        $(`<div>`).text(`${local}`).appendTo(time_container)
        return time_container
    }

    get time_string(){
        const scheduledStartTime = this.stream.liveStreamingDetails.scheduledStartTime
        const timeToStartHours = moment(scheduledStartTime).diff(moment().utc(), "hours")
        const timeToStartMinutes = moment(scheduledStartTime).diff(moment().utc(), "minutes") % 60
        
        let string = `In `
        if(timeToStartHours)
            string += `${timeToStartHours} hours `
        if(timeToStartMinutes)
            string += `${timeToStartMinutes} minutes `
        return string
    }

    update_time(){
        this.stream_item_ui.find('.countdown').text(this.time_string)
    }

}

let widget = new _widget()